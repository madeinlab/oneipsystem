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
	load: function() {
		return Promise.all([
			uci.load('admin_manage')
		]);
	},

	checkPassword: function(section_id, value) {
		var strength = document.querySelector('.cbi-value-description');
		
		// Get settings from password_rule section
		let sections = uci.sections('admin_manage', 'password_rule');
		let minLength = sections[0]?.min_length || '9';
		let maxLength = sections[0]?.max_length || '32';

		// Regular expressions for password validation
		var lengthCheck = new RegExp(`.{${minLength},${maxLength}}`);
		var upperCheck = /[A-Z]/;                     // Uppercase letters
		var lowerCheck = /[a-z]/;                     // Lowercase letters
		var numberCheck = /[0-9]/;                    // Numbers
		var specialCheck = /[!@#$%^&*()]/;            // Special characters
		
		if (strength) {
			// Show requirements only when there's input
			strength.style.display = value.length > 0 ? '' : 'none';
			
			if (value.length > 0) {
				var requirements = [];
				
				// Check each condition and create messages
				if (lengthCheck.test(value)) {
					requirements.push(`<span style="color:green">✓</span> ${_("Length between %d and %d characters").format(minLength, maxLength)}`);
				} else {
					requirements.push(`<span style="color:red">✗</span> ${_("Length between %d and %d characters").format(minLength, maxLength)}`);
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
					requirements.push('<span style="color:red">✗</span> Include special characters (!@#$%^&*())');
				} else {
					requirements.push('<span style="color:green">✓</span> Include special characters (!@#$%^&*())');
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
		let sections = uci.sections('admin_manage', 'password_rule');
		let minLength = sections[0]?.min_length || '9';
		let maxLength = sections[0]?.max_length || '32';

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
			
			// Create requirements div inside the same cbi-value-field
			var requirements = E('div', { 'class': 'cbi-value-description', 'style': 'display:none; font-size:13px; line-height:1.4; margin-top:5px;' }, [
				E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗'), ` Length between ${minLength} and ${maxLength} characters`]),
				E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗'), ' Include uppercase letters']),
				E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗'), ' Include lowercase letters']),
				E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗'), ' Include numbers']),
				E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗'), ' Include special characters (@#$%^&*)'])
			]);

			node.appendChild(requirements);
			return node;
		};

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
		var currentUser = getCurrentUser();

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

					// 1초 후에 리다이렉션 메시지 표시
					setTimeout(function() {
						// 리다이렉션 메시지를 warning으로 표시
						ui.addNotification(null, E('p', [
							E('i', { 'class': 'loading' }),
							' ',
							_('Logging out and redirecting to login page...')
						]), 'warning');

						// 추가로 2초 후에 로그아웃 및 리다이렉션 처리
						setTimeout(function() {
							// 로그아웃 요청
							return fetch('/cgi-bin/luci/admin/logout', {
								method: 'POST',
								credentials: 'include'
							})
							.finally(function() {
								// 로그인 페이지로 리다이렉션
								window.location.href = '/cgi-bin/luci/admin/login';
							});
						}, 2000);  // 총 3초 딜레이 (1초 + 2초)
					}, 1000);

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
