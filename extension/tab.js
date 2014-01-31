$("document").ready(function() {
    var fileSystem = null;
    function createFile(filename, callback) {
        function doCreate() {
            fileSystem.root.getFile(
                filename,
                { create: true },
                function (f) {
                    f.createWriter(
                        function (fw) {
                            callback(fw, f.toURL());
                        },
                        function (e) {
                            console.log("Error creating file writer: " + e.code);
                        }
                    );
                },
                function (e) {
                    console.log("Error creating temporary file: " + e.code);
                }
            );
        }

        if (fileSystem == null) {
            window.webkitRequestFileSystem (
                window.PERSISTENT,
                1024*1024,
                function (fs) {
                    fileSystem = fs;
                    doCreate();
                },
                function (e) {
                    console.log("Error getting file system: " + e.code);
                }
            );
        } else {
            doCreate();
        }
    }

    var fileWriter = {};
    var filePath = {};
    function getFile(filename, callback) {
        if (fileWriter[filename] != null) {
            callback(fileWriter[filename], filePath[filename]);
        } else {
            createFile(filename, function (fw, path) {
                fileWriter[filename] = fw;
                filePath[filename] = path
                callback(fileWriter[filename], filePath[filename]);
            });
        }
    }

    function writeToFile(filename, data, callback) {
        getFile(filename, function (fw, path) {
            var blob = new Blob([data], { type: 'text/plain' });
            var written = false;

            fw.addEventListener("writeend",
                function () {
                    if (written) {
                        callback(path);
                    } else {
                        written = true;
                        fw.seek(0);
                        fw.write(blob);
                    }
                });
            fw.truncate(0);
        });
    }

    var activeSlot = 1;
    if (localStorage['activeSlot'] != undefined) {
        $('#slot1').removeClass('active');
        activeSlot = localStorage['activeSlot'];
        $('#slot' + activeSlot).addClass('active');
    }

    function setActiveSlot(slot) {
        $('#slot' + activeSlot).removeClass('active');
        activeSlot = slot;
        $('#slot' + activeSlot).addClass('active');

        localStorage['activeSlot'] = activeSlot;
        resetContent();
    }

    $('#slot1').bind('click', function() {
        setActiveSlot(1);
    });
    $('#slot2').bind('click', function() {
        setActiveSlot(2);
    });
    $('#slot3').bind('click', function() {
        setActiveSlot(3);
    });
    $('#slot4').bind('click', function() {
        setActiveSlot(4);
    });

    var mdEditor = ace.edit("mdTextarea");
    mdEditor.setTheme("ace/theme/chrome");
    mdEditor.getSession().setMode("ace/mode/markdown");

    function resetContent() {
        if (localStorage['mdContent' + activeSlot] != undefined) {
            mdEditor.setValue(localStorage['mdContent' + activeSlot]);
        } else {
            mdEditor.setValue("Heading\n=======\n\nThis is a paragraph.\n\n  * Lists are also cool\n  * [links too](http://www.google.com)\n\n## Sub-heading\n\n    # This is code\n    return false;\n\n");
        }
        mdEditor.clearSelection();
        mdEditor.navigateFileStart();
        if (localStorage['cssStyle' + activeSlot] != undefined) {
            $('#cssStyle').val(localStorage['cssStyle' + activeSlot]);
        }
        cssChanged = true;
    }
    resetContent();

    mdEditor.getSession().on('change', updateCheck);

    var updateTimeout = null;
    function updateCheck() {
        if (updateTimeout != null) {
            clearTimeout(updateTimeout);
        }
        updateTimeout = setTimeout(update, 200);
    }

    var token = "ØöØ"; // Token to identify current cursor location
    var cssChanged = true; // Flag to indicate whether CSS must be reloaded

    function update() {
        updateTimeout = null;

        var md = mdEditor.getValue();
        var css = $('#cssStyle').val();

        localStorage['mdContent' + activeSlot] = md;

        var cursor = mdEditor.getCursorPosition();
        var cursorIndex = mdEditor.getSession().getDocument().positionToIndex(cursor, 0);
        cursorIndex = md.indexOf('\n', cursorIndex);
        if (cursorIndex == -1)
            md += token;
        else
            md = md.slice(0, cursorIndex) + token + md.slice(cursorIndex);

        var html = markdown.toHTML(md)

        var tokenLocation = html.indexOf(token) + token.length;
        html = html.replace(token, '<span id="cursor"></span>');

        var output = $('#output');

        var iframeBody = output.contents().find('body');
        iframeBody.html(html);

        if (cssChanged) {
            // Prevent flickering by not reloading CSS every update
            var iframeHead = output.contents().find('head');
            iframeHead.html(
                '  <title>Light Markdown Editor - Export</title>\n' +
                (css != 'none' ? '  <link rel="stylesheet" href="' + css + '">\n' : ''));

			localStorage['cssStyle' + activeSlot] = $('#cssStyle').val();
            cssChanged = false;
            
            if (css == 'none') {
				$('#saveCss').addClass('disabled');
			} else {
				$('#saveCss').removeClass('disabled');
			}
        }

        function scroll() {
            // Try to center anchor
            iframeBody.animate({ scrollTop: iframeBody.find('#cursor').offset().top - output.height() / 2 }, 0);
        }
        // Scroll twice due to css load
        scroll();
        setTimeout(function() {
            scroll();
        }, 100);
    }

    // Save current editor contents as .md-file
    function exportMarkdown() {
        var md = mdEditor.getValue();
        console.log("Writing to file");
        writeToFile('lightmd.md',
            md,
            function (path) {
                console.log("Download file: " + path);
                $('#dummylink').attr('download', 'lightmd.md');
                $('#dummylink').attr('href', path);
                $('#dummylink')[0].click();
            });
    }

    // Save current document as exported HTML
    function exportHtml() {
        var md = mdEditor.getValue();
        var css = $('#cssStyle').val();

        console.log("Writing to file");

        writeToFile('lightmd.html',
            '<!DOCTYPE html>\n' +
            '<html>\n' +
            '<head>\n' +
            '  <title>Light Markdown Editor - Export</title>\n' +
            (css != 'none' ? '  <link rel="stylesheet" href="' + css + '">\n' : '') +
            '</head>\n' +
            '<body>\n' +
            markdown.toHTML(md) +
            '\n</body>\n' +
            '</html>\n',
            function (path) {
                console.log("Download file: " + path);
                $('#dummylink').attr('download', 'lightmd.html');
                $('#dummylink').attr('href', path);
                $('#dummylink')[0].click();
            });
    }
    
    
    // Save current CSS style
    function exportCss() {
        var css = $('#cssStyle').val();

		console.log("Download file: " + css);
		$('#dummylink').attr('download', css);
		$('#dummylink').attr('href', chrome.extension.getURL(css));
		$('#dummylink')[0].click();
    }

    $('#cssStyle').bind('change', function() {
        cssChanged = true;
        update();
    });
    $('#save').bind('click', function() { exportMarkdown(); return false; });
    $('#clear').bind('click', function() { if (confirm("Really erase the current document?")) { mdEditor.setValue(''); update(); } return false; });
    $('#saveCss').bind('click', function() { exportCss(); return false; });
    $('#export').bind('click', function() { exportHtml(); return false; });
    $('#print').bind('click', function() {
        window.frames["output"].focus();
        window.frames["output"].print();
        return false;
    });

    // Make sure editor area is offset according to nav bar
    function resizeEditor() {
        var tbHeight = $('#nav').height();
        $('#editor').attr('style','margin-top: -' + tbHeight + 'px; padding-top: ' + tbHeight + 'px');

        mdEditor.resize();
    }

    $(window).resize(resizeEditor);
    resizeEditor();

    update();
});
