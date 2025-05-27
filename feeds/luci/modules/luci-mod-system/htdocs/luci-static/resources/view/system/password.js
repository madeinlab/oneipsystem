'use strict';
'require view';
'require dom';
'require ui';
'require form';
'require rpc';
'require uci';



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

// public.pem 파일 내용을 가져오는 rpc 선언
var callGetPublicPem = rpc.declare({
	object: 'luci',
	method: 'getPublicPem',
	params: []
});

// 1. public.pem을 받아올 때 전역 변수에 저장
var loadedPublicKey = null;

// getUserID RPC 선언
var callGetUserID = rpc.declare({
	object: 'luci',
	method: 'getUserID',
	params: [ 'sessionid' ],
	expect: { }
});

var sessionid = (typeof L !== 'undefined' && L.env && (L.env.sessionid || L.env.ubus_rpc_session))
	|| (window.sessionStorage && sessionStorage.getItem('ubus_rpc_session'));

function hasSequentialCharacters(password, ignoreCase, checkSpecialChars) {

	// 패스워드 길이가 0일 때 'x'로 표시 
	if (password.length === 0) 
		return true

	const specialChars = "!@#$%^&*()";
		
	const normalized = (ignoreCase == '1') ? password.toLowerCase() // 대소문자 구분 안함. 
										: password // 대소문자 구분.
	
	for (let i = 0; i < normalized.length - 2; i++) {
		let char1 = normalized[i];
		let char2 = normalized[i + 1];
		let char3 = normalized[i + 2];

		// ASCII 코드 기준으로 연속된 문자 검사 (예: abc, 123)
		if (char2.charCodeAt(0) === char1.charCodeAt(0) + 1 &&
			char3.charCodeAt(0) === char2.charCodeAt(0) + 1) {
			return true; // 연속된 3자리 문자 확인
		}

		// 동일한 문자 3개 이상 반복 검사 (예: aaa, 111, $$$)
		if (char1 === char2 && char2 === char3) {
			return true; // 동일 문자 3개 이상 반복
		}

		if (checkSpecialChars == '1') {
			// 특수문자 연속성 체크 (예: !@#, #$%)
			if (specialChars.includes(char1) &&
				specialChars.includes(char2) &&
				specialChars.includes(char3)) {
				let idx1 = specialChars.indexOf(char1);
				let idx2 = specialChars.indexOf(char2);
				let idx3 = specialChars.indexOf(char3);

				if (idx2 === idx1 + 1 && idx3 === idx2 + 1) {
					return true; // 연속된 특수문자 확인
				}
			}

			// 동일한 특수문자 3개 이상 반복 검사 (예: !!!, @@@)
			if (char1 === char2 && char2 === char3 && specialChars.includes(char1)) {
				return true; // 동일 특수문자 3개 이상 반복
			}
		}
	}
	
	return false; // 연속된 문자 없음
}

let checkSequential, checkSequnetialIgnoreCase, checkSequentialSpecial;

return view.extend({
	load: function() {
		// getUserID 테스트: RPC 호출 및 결과 저장
		window._getUserIDTestResult = null;
		callGetUserID(sessionid).then(function(res) {
			window._getUserIDTestResult = res;
		});
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
		var lengthCheck = new RegExp(`^.{${minLength},${maxLength}}$`);
		var upperCheck = /[A-Z]/;                     // Uppercase letters
		var lowerCheck = /[a-z]/;                     // Lowercase letters
		var numberCheck = /[0-9]/;                    // Numbers
		var specialCheck = /[!@#$%^&*()]/;            // Special characters
		var sequentialCheck = true;                   // Sequentail characters
		
		if (strength) {
			// Show requirements only when there's input
			strength.style.display = value.length > 0 ? '' : 'none';
			
			if (value.length > 0) {
				var requirements = [];
				
				// Check each condition and create messages
				if (lengthCheck.test(value)) {
					requirements.push(`<span style="color:green">✓</span> ${_('Length between %d and %d characters').format(minLength, maxLength)}`);
				} else {
					requirements.push(`<span style="color:red">✗</span> ${_('Length between %d and %d characters').format(minLength, maxLength)}`);
				}
				
				if (!upperCheck.test(value)) {
					requirements.push(`<span style="color:red">✗</span> ${_('Include uppercase letters')}`);
				} else {
					requirements.push(`<span style="color:green">✓</span> ${_('Include uppercase letters')}`);
				}
				
				if (!lowerCheck.test(value)) {
					requirements.push(`<span style="color:red">✗</span> ${_('Include lowercase letters')}`);
				} else {
					requirements.push(`<span style="color:green">✓</span> ${_('Include lowercase letters')}`);
				}
				
				if (!numberCheck.test(value)) {
					requirements.push(`<span style="color:red">✗</span> ${_('Include numbers')}`);
				} else {
					requirements.push(`<span style="color:green">✓</span> ${_('Include numbers')}`);
				}
				
				if (!specialCheck.test(value)) {
					requirements.push(`<span style="color:red">✗</span> ${_('Include special characters (!@#$%^&*())')}`);
				} else {
					requirements.push(`<span style="color:green">✓</span> ${_('Include special characters (!@#$%^&*())')}`);
				}

				if (checkSequential == '1') {
					if (hasSequentialCharacters(value, checkSequnetialIgnoreCase, checkSequentialSpecial)) {
						requirements.push(`<span style="color:red">✗</span> ${_('Do not include 3 or more sequential or identical characters')}`);
						sequentialCheck = false;
					} else {
						requirements.push(`<span style="color:green">✓</span> ${_('Do not include 3 or more sequential or identical characters')}`);
						sequentialCheck = true;
					}
				}
				
				// Display all requirements in HTML
				strength.innerHTML = requirements.join('<br>');
			}
			
			// Check if all conditions are met
			return lengthCheck.test(value) &&
				   upperCheck.test(value) &&
				   lowerCheck.test(value) &&
				   numberCheck.test(value) &&
				   specialCheck.test(value) &&
				   sequentialCheck;
		}
		
		return true;
	},

	render: function() {
		var m, s, o;
		let sections = uci.sections('admin_manage', 'password_rule');
		let minLength = sections[0]?.min_length || '9';
		let maxLength = sections[0]?.max_length || '32';

		checkSequential = sections[0]?.check_sequential || '0';
		if (checkSequential == '1') {
			checkSequnetialIgnoreCase = sections[0]?.check_sequential_ignore_case || '0';
			checkSequentialSpecial = sections[0]?.check_sequential_special || '0';
		} else {
			checkSequnetialIgnoreCase = '0';
			checkSequentialSpecial = '0';
		}		

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
				E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗ '), _('Length between %d and %d characters').format(minLength, maxLength)]),
				E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗ '), _('Include uppercase letters')]),
				E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗ '), _('Include lowercase letters')]),
				E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗ '), _('Include numbers')]),
				E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗ '), _('Include special characters (!@#$%^&*())')])
			]);

			if (checkSequential === '1') {
				requirements.appendChild(E('div', {}, [E('span', { 'style': 'color:var(--danger-color)' }, '✗ '), _('Do not include 3 or more sequential or identical characters')]));
			}

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

		// 1. public.pem을 받아올 때 전역 변수에 저장
		setTimeout(function() {
			callGetPublicPem().then(function(res) {
				if (res && res.result) {
					loadedPublicKey = res.result; // 전역 변수에 저장
				}
			}).catch(function(err) {
				console.error('[DEBUG] getPublicPem RPC exception:', err);
				pemDiv.textContent = _('Failed to load public.pem (exception)');
			});
		}, 0);

		return m.render();
	},

	handleSave: function() {
		var map = document.querySelector('.cbi-map');
		var requirements = document.querySelector('.cbi-value-description');
		var currentUser = window._getUserIDTestResult.username; // getUserID RPC 결과 사용

		console.log('[DEBUG] handleSave: called');
		console.log('[DEBUG] handleSave: currentUser =', currentUser);
		console.log('[DEBUG] handleSave: loadedPublicKey =', loadedPublicKey);
		console.log('[DEBUG] handleSave: formData.password =', formData.password);

		if (!currentUser) {
			console.warn('[DEBUG] handleSave: No user detected');
			ui.addNotification(null, E('p', _('No user detected. Cannot change password.')), 'danger');
			return;
		}

		// 1. JSEncrypt 동적 로드 (맨 위에 위치)
		if (!window.JSEncrypt) {
			console.warn('[DEBUG] handleSave: JSEncrypt not loaded, will load dynamically in 1 second...');
			setTimeout(function() {
				var script = document.createElement('script');
				script.src = '/luci-static/resources/jsencrypt.min.js';
				script.onload = function() {
					console.log('[DEBUG] handleSave: JSEncrypt loaded, retrying save');
					dom.callClassMethod(map, 'save');
				};
				document.head.appendChild(script);
			}, 3000);
		}

		return dom.callClassMethod(map, 'save').then(function() {
			if (formData.password.pw1 == null || formData.password.pw1.length == 0) {
				console.warn('[DEBUG] handleSave: Password is empty');
				return;
			}

			if (formData.password.pw1 != formData.password.pw2) {
				console.warn('[DEBUG] handleSave: Password confirmation does not match');
				ui.addNotification(null, E('p', _('Given password confirmation did not match, password not changed!')), 'danger');
				return;
			}

			// 1. public.pem 내용 가져오기
			var pubkey = loadedPublicKey;
			console.log('[DEBUG] handleSave: pubkey =', pubkey);
			if (!pubkey || pubkey.indexOf('BEGIN PUBLIC KEY') === -1) {
				console.warn('[DEBUG] handleSave: No public key loaded');
				ui.addNotification(null, E('p', _('No public key loaded, cannot encrypt password!')), 'danger');
				return;
			}

			// 2. JSEncrypt로 암호화
			var encrypt = new JSEncrypt();
			encrypt.setPublicKey(pubkey);

			var encryptedPw = encrypt.encrypt(formData.password.pw1);
			console.log('[DEBUG] handleSave: encryptedPw =', encryptedPw);
			if (!encryptedPw) {
				console.warn('[DEBUG] handleSave: Password encryption failed');
				ui.addNotification(null, E('p', _('Password encryption failed!')), 'danger');
				return;
			}

			// 3. 암호문을 서버로 전송 (callSetPassword 대신 fetch 사용, 변수명 충돌 방지)
			var postData = new FormData();
			postData.append('new_password', encryptedPw);

			fetch('/cgi-bin/luci/admin/system/password', {
				method: 'POST',
				body: postData
			})
			.then(response => response.text())
			.then(html => {
				if (html === 'success') {
					if (requirements) requirements.innerHTML = '';
					ui.addNotification(null, E('p', _('The system password has been successfully changed.')), 'info');
					setTimeout(function() {
						ui.addNotification(null, E('p', [
							E('i', { 'class': 'loading' }),
							' ',
							_('Logging out and redirecting to login page...')
						]), 'warning');
						setTimeout(function() {
							fetch('/cgi-bin/luci/admin/logout', { method: 'POST', credentials: 'include' })
							.finally(function() {
								window.location.href = '/cgi-bin/luci/admin/login';
							});
						}, 2000);
					}, 1000);
				} else {
					console.warn('[DEBUG] handleSave: Failed to change the system password');
					ui.addNotification(null, E('p', _('Failed to change the system password.')), 'danger');
				}
				formData.password.pw1 = null;
				formData.password.pw2 = null;
				dom.callClassMethod(map, 'render');
			})
			.catch(error => {
				console.error('[DEBUG] handleSave: Error:', error);
				ui.addNotification(null, E('p', _('Error occurred while changing password.')), 'danger');
			});
		});
	},

	handleSaveApply: null,
	handleReset: null
});
