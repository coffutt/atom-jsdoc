'use strict';

var commentator = require('./commentator'),
    leadingWhitespace = /^(\s+)?/, // Regex to pull out any leading whitespaces
    firstBlockComment = /^\s+\/\*[^\/]/, // Matches one to many white spaces followed by /*, not followed by /
    blockComment = /^\s+\*[^\/]/, // Matches one to many white spaces followed by *, not followed by /
    lineComment = /^((\s+\/\/)|(\/\/))/;

/**
 * getLine - Get the full line where the cursor resides
 *
 * @param  {Editor} editor The atom editor instance
 * @return {String}        The string at the current cursor line
 */
function getLine (editor) {
    editor.moveCursorToBeginningOfLine();
    editor.selectToEndOfLine();
    return editor.getSelectedText();
}

function continueComments (editor) {
    var currentPosition = editor.getCursorBufferPosition(),
        previousLineText = editor.lineTextForBufferRow(currentPosition.row - 1),
        moveColumns = 0;

    // If the previous line is a comment, lets assume we want to continue comment.
    if (previousLineText.match(firstBlockComment) || previousLineText.match(blockComment)) {
        // setTimeout delegates insertion to after editor has actually
        // moved cursor at next line
        editor.insertText(' * ');
        moveColumns = 3;
    } else if (previousLineText.match(lineComment)) {
        editor.insertText('// ');
        moveColumns = 3;
    }
}

/**
 * writeBlock - Write out a block comment based on the current cursor position. If the position
 * is right above a function declaration, write out a jsdoc style comment, otherwise write out a
 * plain old block comment.
 *
 * @return undefined
 */
function writeBlock () {
    var editor = atom.workspace.activePaneItem,
        initialCursorPosition = editor.getCursorBufferPosition(),
        commentStart = initialCursorPosition.row + 1,
        commentEnd,
        thisLine,
        nextLine,
        indent,
        comment,
        commentLines,
        commentType;

    // Get the text on the current line and the one below it.
    thisLine = getLine(editor);
    editor.moveCursorDown();
    nextLine = getLine(editor);
    indent = nextLine.match(leadingWhitespace)[1] || thisLine.match(leadingWhitespace)[1] || '';

    // If the cursor was located on a line that wasn't entirely white space,
    // lets assume the comment is for the below line and insert the comment between the
    // current line and the line below it.
    if (thisLine.trim() !== '') {
        editor.setCursorBufferPosition(initialCursorPosition);
        editor.insertNewlineBelow();
        editor.moveCursorDown();
        nextLine = getLine(editor);
    }

    // Generate the comment off of the current and next lines
    comment = commentator.makeComment(thisLine, nextLine);
    commentLines = comment.lines;
    commentType = comment.type;

    // Move the cursor to the beginning of where we'll start writing our comment.
    editor.setCursorBufferPosition([initialCursorPosition.row, 0]);
    editor.insertNewlineBelow();
    editor.moveCursorToBeginningOfLine();

    // Write out each of the comment lines one by one
    commentLines.forEach(function (line, index) {
        editor.insertText(indent + line);
        if (index !== commentLines.length - 1) {
            editor.insertNewlineBelow();
            editor.moveCursorToBeginningOfLine();
        }
    });

    commentEnd = editor.getCursorBufferPosition().row;

    // If the comment is an empty comment, just move it to the first line in the comment so the user
    // can just start typing their comment. If it's a function comment, we'll highlight the description
    // placeholder in the main section of the comment for easy editing.
    if (commentType === 'EMPTY') {
        editor.moveCursorUp();
    } else {
        editor.setCursorBufferPosition([initialCursorPosition.row + 2, 0]);
        editor.moveCursorToEndOfLine();
        editor.selectToPreviousWordBoundary();

        // We're looking for the 'description' text in the main comment body so that we can
        // highlight it for easy editing.
        while (editor.getSelectedText().match(/^\s+$/)) {
            editor.selectToPreviousWordBoundary();
        }
    }
}

module.exports = {

    /**
     * activite - The basic activate hook for atom to pullin the package.
     *
     * @param  {state} The app state
     * @return undefined
     */
    activate: function (state) {
        atom.commands.add('atom-text-editor', {
            'jsdoc:block': writeBlock,
            'editor:newline': function(event) {
                continueComments(this.getModel());
            }
        });
    }

};
