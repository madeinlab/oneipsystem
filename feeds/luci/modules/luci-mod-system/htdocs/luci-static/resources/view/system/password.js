'use strict';
'require view';
'require dom';
'require ui';
'require form';
'require rpc';
'require uci';

function getCurrentUser() {
	return L.env.username || 'doowon';  // Fallback to doowon if username is not available
}

var formData = {
	password: {
		pw1: null,
		pw2: null
	}
};

var callSetPassword = rpc.declare({
	object: 'luci',
	method: 'setPassword',
	params: [ 'username', 'password' ],
	expect: { result: false }
});

return view.extend({
	checkPassword: function(section_id, value) {
		var strength = document.querySelector('.cbi-value-description');
		
		// Regular expressions for password validation
		var lengthCheck = /.{9,}/;                    // At least 9 characters
		var upperCheck = /[A-Z]/;                     // Uppercase letters
		var lowerCheck = /[a-z]/;                     // Lowercase letters
		var numberCheck = /[0-9]/;                    // Numbers
		var specialCheck = /[@#$%^&*]/;               // Special characters
		
		if (strength) {
			// Show requirements only when there's input
			strength.style.display = value.length > 0 ? '' : 'none';
			
			if (value.length > 0) {
				var requirements = [];
				
				// Check each condition and create messages
				if (lengthCheck.test(value)) {
					requirements.push('<span style="color:green">✓</span> Minimum 9 characters');
				} else {
					requirements.push('<span style="color:red">✗</span> Minimum 9 characters');
				}
				
				if (!upperCheck.test(value)) {
					requirements.push('<span style="color:red">✗</span> Include uppercase letters');
				} else {
					requirements.push('<span style="color:green">✓</span> Include uppercase letters');
				}
				
				if (!lowerCheck.test(value)) {
					requirements.push('<span style="color:red">✗</span> Include lowercase letters');
				} else {
					requirements.push('<span style="color:green">✓</span> Include lowercase letters');
				}
				
				if (!numberCheck.test(value)) {
					requirements.push('<span style="color:red">✗</span> Include numbers');
				} else {
					requirements.push('<span style="color:green">✓</span> Include numbers');
				}
				
				if (!specialCheck.test(value)) {
					requirements.push('<span style="color:red">✗</span> Include special characters (@#$%^&*)');
				} else {
					requirements.push('<span style="color:green">✓</span> Include special characters (@#$%^&*)');
				}
				
				// Display all requirements in HTML
				strength.innerHTML = requirements.join('<br>');
			}
			
			// Check if all conditions are met
			return lengthCheck.test(value) &&
				   upperCheck.test(value) &&
				   lowerCheck.test(value) &&
				   numberCheck.test(value) &&
				   specialCheck.test(value);
		}
		
		return true;
	},

	render: function() {
		var m, s, o;

		m = new form.JSONMap(formData, _('Router Password'), _('Changes the administrator password for accessing the device'));
		m.readonly = !L.hasViewPermission();

		s = m.section(form.NamedSection, 'password', 'password');

		// First: Password input field
		o = s.option(form.Value, 'pw1', _('Password'));
		o.password = true;
		o.validate = this.checkPassword;  // Connect password validation function
		
		// Add input event listener to password field
		o.renderWidget = function(/* ... */) {
			var node = form.Value.prototype.renderWidget.apply(this, arguments);
			var input = node.querySelector('input');
			var requirements = document.querySelector('.cbi-value-description');
			
			input.addEventListener('input', function(ev) {
				if (requirements) {
					requirements.style.display = ev.target.value.length > 0 ? 'block' : 'none';
				}
			});

			return node;
		};

		// Second: Password requirements display (initially hidden)
		var requirements = s.option(form.DummyValue, '_requirements', '');
		requirements.rawhtml = true;
		requirements.default = '<div class="cbi-value-description" style="display:none">' +
			'<span style="color:red">✗</span> Minimum 9 characters<br>' +
			'<span style="color:red">✗</span> Include uppercase letters<br>' +
			'<span style="color:red">✗</span> Include lowercase letters<br>' +
			'<span style="color:red">✗</span> Include numbers<br>' +
			'<span style="color:red">✗</span> Include special characters (@#$%^&*)</div>';

		// Third: Password confirmation field
		o = s.option(form.Value, 'pw2', _('Confirmation'));
		o.password = true;
		o.renderWidget = function(/* ... */) {
			var node = form.Value.prototype.renderWidget.apply(this, arguments);

			node.querySelector('input').addEventListener('keydown', function(ev) {
				if (ev.keyCode == 13 && !ev.currentTarget.classList.contains('cbi-input-invalid'))
					document.querySelector('.cbi-button-save').click();
			});

			return node;
		};

		return m.render();
	},

	handleSave: function() {
		var map = document.querySelector('.cbi-map');
		var requirements = document.querySelector('.cbi-value-description');
		var currentUser = getCurrentUser();  // Get current logged-in user

		return dom.callClassMethod(map, 'save').then(function() {
			if (formData.password.pw1 == null || formData.password.pw1.length == 0)
				return;

			if (formData.password.pw1 != formData.password.pw2) {
				ui.addNotification(null, E('p', _('Given password confirmation did not match, password not changed!')), 'danger');
				return;
			}

			return callSetPassword(currentUser, formData.password.pw1).then(function(success) {
				if (success) {
					// Clear password requirements display
					if (requirements) {
						requirements.innerHTML = '';
					}
					ui.addNotification(null, E('p', _('The system password has been successfully changed.')), 'info');
				} else {
					ui.addNotification(null, E('p', _('Failed to change the system password.')), 'danger');
				}

				formData.password.pw1 = null;
				formData.password.pw2 = null;

				dom.callClassMethod(map, 'render');
			});
		});
	},

	handleSaveApply: null,
	handleReset: null
});
