/**
 * @license
 * Copyright (C) 2013 Steven Berry (http://www.sberry.me/inputhistory)
 * Licensed: MIT (http://opensource.org/licenses/mit-license.php)
 * License Stipulations:
 *     1) Retain this comment block.
 *     2) Send me an email if you use this and have questions/comments!
 * 
 * Steven Berry
 * www.sberry.me
 * steven@sberry.me
 */
(function(root, factory) {
	if (typeof module === 'object' && module && typeof module.exports === 'object') {
		factory.call(root, require('jquery'));
	}
	else if (typeof define === 'function' && define.amd) {
		define(['jquery'], function() {
			return factory.apply(root, arguments);
		});
	}
	else if (typeof root === 'object' && root && typeof root.document === 'object') {
		factory.call(root, root.jQuery);
	}
})(this, function($, undefined) {
	var window = this;
	var document = window.document;
	
	// The $.fn.delegate() matching pattern for elements that should be processed for history.
	var ELEMENT_PATTERN = 'input.ih-enabled[type="text"]';
	// The jQuery data attribute used to store History instances for inputs.
	var DATA_ATTR = 'ih-history';
	// The (arbitrary) limit of history items to store per enabled input.
	var MAX_LENGTH = 10;
	
	/**
	 * An internally referenced container object that is used to store history
	 * entries for inputhistory-enabled inputs.
	 *
	 * @private
	 * @class
	 * @property {Array} commands An arry of past commands unique to an inputhistory-enabled input.
	 * @property {number} _index The index of the currently accessed history item.
	 * @property {string} _unrun The unrun command stored if a previous history item is accessed. This is used instead of pushing the unrun command onto `commands`.
	 */
	function History() {
		this.commands = [];
		this._index = 0;
		this._unrun = null;
	}
	History.prototype = {
		/**
		 * Saves a value as the unrun command.
		 * Used to save a reference and preserve an un-run command during
		 * history navigation and before a new command is pushed.
		 * (e.g. if .prev() is used accidentally or for reference, .next() can be used to retrieve the un-run command).
		 *
		 * @param {string} cmd The text command to save as the un-run command.
		 */
		save: function(cmd) {
			if (this._unrun === null) {
				this._unrun = cmd;
			}
		},
		
		/**
		 * Pushes a text command onto the history array.
		 * If the array length exceeds the maximum allowed, the array is shifted after the push.
		 *
		 * @param {string} cmd The text command to push onto the history array.
		 */
		push: function(cmd) {
			var item, commands = this.commands;
			
			item = commands[commands.length - 1];
			// Only push the cmd if the argument is defined and it does
			// not equal the last pushed command.
			if (typeof item === 'undefined' || item != cmd) {
				commands.push(cmd);
				
				// If we exceed the max length, then shift off the first element.
				if (commands.length > MAX_LENGTH) {
					commands.shift();
				}
			}
			
			// Clear the bookmarked reference to the unrun command (because we just ran it).
			this._unrun = null;
			// Set the index to the unrun command pseudoindex.
			this._index = commands.length;
		},
		
		/**
		 * Returns the next history item or the un-run command if
		 * the current `_index` exceeds the end of the `commands` array.
		 *
		 * @returns {string} The next (`_index` + 1) command in the `commands` array.
		 */
		next: function() {
			var item, commands = this.commands;
			
			// Don't go to the next index if we're already at the end.
			// This check is sufficnet unless the index was changed by a third party.
			// We DO want to allow setting the index ONE longer than the length
			// to work in the un-run command.
			if (this._index < commands.length) {
				this._index++;
			}
			
			// If the current index is the length of the array, the index is technically
			// out of bounds. This is OK in our case, just pull the unrun command instead and
			// clear out the internal reference to the unrun command bookmark.
			if (this._index === commands.length) {
				item = this._unrun;
				this._unrun = null;
			}
			// Otherwise pull the index position in the `command` array.
			else {
				item = commands[this._index];
			}
			
			return item;
		},
		
		/**
		 * Returns the previous history item in the `commands` array
		 * or the first item if desired `_index` precedes the beginning of
		 * the `commands` array.
		 *
		 * @returns {string} The next (`_index` - 1) command in the `commands` array.
		 */
		prev: function() {
			// Don't go to the previous index if we're already at the beginning.
			// This check is sufficent unless the index was changed by a third party.
			if (this._index > 0) {
				this._index--;
			}

			return this.commands[this._index];
		}
	};
	
	/**
	 * Returns the `History` instance associated with a given input.
	 * If no `History` instance exists, a new instance is created
	 * and associated with the given input.
	 *
	 * @private
	 * @returns {History} The `History` instance associated with the input or a new instance.
	 */
	function getHistory() {
		var history, $this = $(this);
		
		history = $this.data(DATA_ATTR);
		
		if (!(history instanceof History)) {
			history = new History();
			$this.data(DATA_ATTR, history);
		}
		
		return history;
	}
	
	/**
	 * Handles pushing new commands onto the inputs `History` object.
	 *
	 * @private
	 * @param {Object} e The event object passed in by $.fn.delegate().
	 */
	function pushHandler(e) {
		var history, value, $this = $(this);
		
		history = getHistory.call(this);
		value = $this.val();
		
		// Only push the history item if the length is > 0.
		// TODO(?): Should I support adding empty space as a run command?
		// I don't want to trim the input first in case leading/trailing
		// spaces are desired. I think I may just keep this as is.
		if (value.length > 0) {
			history.push(value);
		}
	}
	
	/**
	 * Handles returning saved commands in response to UI input.
	 *
	 * @private
	 * @param {Object} e The event object passed in by $.fn.delegate().
	 */
	function loadHandler(e) {
		var history, value, which = e.which || e.keyCode, $this;
		
		// Test if the ALT modifier is pressed and if
		// they key pressed matches the interface keys (UP or DOWN).
		if (e.altKey && (which === 38 || which === 40)) {
			$this = $(this);
			// Get the current history object.
			// We now have an object reference, so this object
			// can be modified directly.
			history = getHistory.call(this);
			value = $this.val();
		
			if (which === 38) { // UP arrow -> Previous history item
				// Make sure to save the unrun command first
				history.save(value);
				$this.val(history.prev());
			}
			else { // DOWN arrow -> Next history item
				// Make sure to save the unrun command first
				history.save(value);
				$this.val(history.next());
			}
		}
	}
	
	$.extend({
		/**
		 * @param {String} [selector] 
		 */
		inputhistory: function(selector) {
			var $document = $(document);
			
			selector = selector || ELEMENT_PATTERN;
			
			$document.on('blur', selector, pushHandler);
			$document.on('keydown', selector, loadHandler);
		}
	});
});