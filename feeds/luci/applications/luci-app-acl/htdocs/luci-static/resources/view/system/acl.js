'use strict';
'require view';
'require dom';
'require fs';
'require ui';
'require uci';
'require form';
'require tools.widgets as widgets';

var aclList = {};

function globListToRegExp(section_id, option) {
	var list = L.toArray(uci.get('rpcd', section_id, option)),
	    positivePatterns = [],
	    negativePatterns = [];

	if (option == 'read')
		list.push.apply(list, L.toArray(uci.get('rpcd', section_id, 'write')));

	for (var i = 0; i < list.length; i++) {
		var array, glob;

		if (list[i].match(/^\s*!/)) {
			glob = list[i].replace(/^\s*!/, '').trim();
			array = negativePatterns;
		}
		else {
			glob = list[i].trim(),
			array = positivePatterns;
		}

		array.push(glob.replace(/[.*+?^${}()|[\]\\]/g, function(m) {
			switch (m[0]) {
			case '?':
				return '.';

			case '*':
				return '.*';

			default:
				return '\\' + m[0];
			}
		}));
	}

	return [
		new RegExp('^' + (positivePatterns.length ? '(' + positivePatterns.join('|') + ')' : '') + '$'),
		new RegExp('^' + (negativePatterns.length ? '(' + negativePatterns.join('|') + ')' : '') + '$')
	];
}

var cbiACLLevel = form.DummyValue.extend({
	textvalue: function(section_id) {
		var allowedAclMatches = globListToRegExp(section_id, this.option.match(/read/) ? 'read' : 'write'),
		    aclGroupNames = Object.keys(aclList),
		    matchingGroupNames = [];

		for (var j = 0; j < aclGroupNames.length; j++)
			if (allowedAclMatches[0].test(aclGroupNames[j]) && !allowedAclMatches[1].test(aclGroupNames[j]))
				matchingGroupNames.push(aclGroupNames[j]);

		if (matchingGroupNames.length == aclGroupNames.length)
			return E('span', { 'class': 'label' }, [ _('full', 'All permissions granted') ]);
		else if (matchingGroupNames.length > 0)
			return E('span', { 'class': 'label' }, [ _('partial (%d/%d)', 'Some permissions granted').format(matchingGroupNames.length, aclGroupNames.length) ]);
		else
			return E('span', { 'class': 'label warning' }, [ _('denied', 'No permissions granted') ]);
	}
});

var cbiACLSelect = form.Value.extend({
	renderWidget: function(section_id) {
		var readMatches = globListToRegExp(section_id, 'read'),
		    writeMatches = globListToRegExp(section_id, 'write');

		var table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr' }, [
				E('th', { 'class': 'th' }, [ _('ACL group') ]),
				E('th', { 'class': 'th' }, [ _('Description') ]),
				E('th', { 'class': 'th' }, [ _('Access level') ])
			]),
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ '' ]),
				E('td', { 'class': 'td' }, [ '' ]),
				E('td', { 'class': 'td' }, [
					_('Set all: ', 'Set all permissions in the table below to one of the given values'),
					E('a', { 'href': '#', 'click': function() {
						table.querySelectorAll('select').forEach(function(select) { select.value = select.options[0].value });
					} }, [ _('denied', 'No permissions granted') ]), ' | ',
					E('a', { 'href': '#', 'click': function() {
						table.querySelectorAll('select').forEach(function(select) { select.value = 'read' });
					} }, [ _('readonly', 'Only read permissions granted') ]), ' | ',
					E('a', { 'href': '#', 'click': function() {
						table.querySelectorAll('select').forEach(function(select) { select.value = 'write' });
					} }, [ _('full', 'All permissions granted') ]),
				])
			])
		]);

		Object.keys(aclList).sort().forEach(function(aclGroupName) {
			var isRequired = (aclGroupName == 'unauthenticated' || aclGroupName == 'luci-base'),
			    isReadable = (readMatches[0].test(aclGroupName) && !readMatches[1].test(aclGroupName)) || null,
			    isWritable = (writeMatches[0].test(aclGroupName) && !writeMatches[1].test(aclGroupName)) || null;

			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ aclGroupName ]),
				E('td', { 'class': 'td' }, [ aclList[aclGroupName].description || '-' ]),
				E('td', { 'class': 'td' }, [
					E('select', { 'data-acl-group': aclGroupName }, [
						isRequired ? E([]) : E('option', { 'value': '' }, [ _('denied', 'No permissions granted') ]),
						E('option', { 'value': 'read', 'selected': isReadable }, [ _('readonly', 'Only read permissions granted') ]),
						E('option', { 'value': 'write', 'selected': isWritable }, [ _('full', 'All permissions granted') ])
					])
				])
			]));
		});

		return table;
	},

	formvalue: function(section_id) {
		var node = this.map.findElement('data-field', this.cbid(section_id)),
		    data = {};

		node.querySelectorAll('[data-acl-group]').forEach(function(select) {
			var aclGroupName = select.getAttribute('data-acl-group'),
			    value = select.value;

			if (!value)
				return;

			switch (value) {
			case 'write':
				data.write = data.write || [];
				data.write.push(aclGroupName);
				/* fall through */

			case 'read':
				data.read = data.read || [];
				data.read.push(aclGroupName);
				break;
			}
		});

		return data;
	},

	write: function(section_id, value) {
		uci.unset('rpcd', section_id, 'read');
		uci.unset('rpcd', section_id, 'write');

		if (L.isObject(value) && Array.isArray(value.read))
			uci.set('rpcd', section_id, 'read', value.read);

		if (L.isObject(value) && Array.isArray(value.write))
			uci.set('rpcd', section_id, 'write', value.write);
	}
});

var minLength, maxLength

return view.extend({
	load: function() {
		return L.resolveDefault(fs.list('/usr/share/rpcd/acl.d'), []).then(function(entries) {
			var tasks = [
				L.resolveDefault(fs.stat('/usr/bin/openssl'), null),
				fs.lines('/etc/passwd')
			];

			for (var i = 0; i < entries.length; i++)
				if (entries[i].type == 'file' && entries[i].name.match(/\.json$/))
					tasks.push(L.resolveDefault(fs.read('/usr/share/rpcd/acl.d/' + entries[i].name).then(JSON.parse)));

			tasks.push(uci.load('admin_manage').then(function() {
				var sections = uci.sections('admin_manage', 'password_rule');
			
				if (sections.length > 0) {
					minLength = sections[0].min_length || '9';
					maxLength = sections[0].max_length || '32';
				} else {
					minLength = '9';  // default
					maxLength = '32'; // default
				}
			}));

			return Promise.all(tasks);
		});
	},

	render: function(data) {
		var has_openssl = data[0],
		    known_unix_users = {};

		for (var i = 0; i < data[1].length; i++) {
			var parts = data[1][i].split(/:/);

			if (parts.length >= 7)
				known_unix_users[parts[0]] = true;
		}

		// uid=0인 사용자 이름을 가져오는 함수
		function getUserNameUID0() {
			for (var i = 0; i < data[1].length; i++) {
				var parts = data[1][i].split(/:/);
				if (parts.length >= 7 && parseInt(parts[2], 10) === 0) {
					return parts[0]; // uid=0인 사용자 이름 반환
				}
			}
			return null; // uid=0인 사용자가 없는 경우
		}
		
		// uid=0인 사용자인지 확인하는 함수
		function isRootUser(username) {
			var superuser = getUserNameUID0();
			return username === superuser;
		}

		for (var i = 2; i < data.length; i++) {
			if (!L.isObject(data[i]))
				continue;

			for (var aclName in data[i]) {
				if (!data[i].hasOwnProperty(aclName))
					continue;

				aclList[aclName] = data[i][aclName];
			}
		}

		var m, s, o;

		m = new form.Map('rpcd', _('LuCI Logins'));
		
		// 원래 Map의 render 함수를 저장
		var originalRender = m.render;
		
		// render 함수 오버라이드
		m.render = function() {
			// 원래 render 함수 호출
			var result = originalRender.apply(this, arguments);
			
			// 초기화 버튼 비활성화 처리
			result.then(function() {
				// 페이지가 렌더링된 후 실행
				window.requestAnimationFrame(function() {
					// 초기화 버튼 찾기
					var resetBtn = document.querySelector('.cbi-page-actions .cbi-button-reset');
					if (resetBtn) {
						// 초기화 버튼 비활성화
						resetBtn.setAttribute('disabled', 'disabled');
					}
				});
			});
			
			return result;
		};

		s = m.section(form.GridSection, 'login');
		s.anonymous = true;
		s.addremove = function(section_id) {
			var username = uci.get('rpcd', section_id, 'username');
			return !isRootUser(username);
		};

		s.renderRowActions = function(section_id) {
			var td = form.GridSection.prototype.renderRowActions.apply(this, [section_id]);
			var username = uci.get('rpcd', section_id, 'username');
			
			if (isRootUser(username)) {
				// 루트 유저인 경우 삭제 버튼만 비활성화
				td.querySelectorAll('.cbi-button-remove').forEach(function(btn) {
					btn.setAttribute('disabled', 'disabled');
				});
			}
			
			return td;
		};

		s.handleEdit = function(section_id) {
			// 모든 계정 편집 가능 (루트 유저 포함)
			return form.GridSection.prototype.handleEdit.apply(this, [section_id]);
		};

		s.handleRemove = function(section_id) {
			var username = uci.get('rpcd', section_id, 'username');
			if (isRootUser(username)) {
				return false;
			}
			return form.GridSection.prototype.handleRemove.apply(this, [section_id]);
		};

		s.modaltitle = function(section_id) {
			return _('LuCI Logins') + ' » ' + (uci.get('rpcd', section_id, 'username') || _('New account'));
		};

		o = s.option(form.Value, 'username', _('Login name'));
		o.rmempty = false;
		o.readonly = function(section_id) {
			// 디버그 로그 추가
			console.log('[DEBUG] readonly 함수 호출됨');
			console.log('[DEBUG] section_id:', section_id);
			
			var username = uci.get('rpcd', section_id, 'username');
			console.log('[DEBUG] username:', username);
			console.log('[DEBUG] isRootUser 호출 전');
			
			// 새 계정 생성 시에는 username이 없으므로 false 반환 (편집 가능)
			if (!username) {
				console.log('[DEBUG] username이 없음, 편집 가능');
				return false;
			}
			
			var isRoot = isRootUser(username);
			console.log('[DEBUG] isRootUser 결과:', isRoot);
			
			if (isRoot) {
				console.log('[DEBUG] 루트 사용자, 읽기 전용');
				return true;
			}
			else {
				console.log('[DEBUG] 일반 사용자, 편집 가능');
				return false;
			}
		};

		o = s.option(form.ListValue, '_variant', _('Password variant'));
		o.modalonly = true;
		o.value('shadow', _('Use UNIX password in /etc/shadow'));
		o.value('crypted', _('Use encrypted password hash'));
		o.cfgvalue = function(section_id) {
			var value = uci.get('rpcd', section_id, 'password') || '';

			if (value.substring(0, 3) == '$p$')
				return 'shadow';
			else
				return 'crypted';
		};
		o.write = function() {};

		o = s.option(widgets.UserSelect, '_account', _('UNIX account'), _('The system account to use the password from'));
		o.modalonly = true;
		o.depends('_variant', 'shadow');
		o.cfgvalue = function(section_id) {
			var value = uci.get('rpcd', section_id, 'password') || '';
			return value.substring(3);
		};
		o.write = function(section_id, value) {
			uci.set('rpcd', section_id, 'password', '$p$' + value);
		};
		o.remove = function() {};

		o = s.option(form.Value, 'password', _('Password value'));
		o.modalonly = true;
		o.password = true;
		o.rmempty = false;
		o.depends('_variant', 'crypted');
		o.cfgvalue = function(section_id) {
			var value = uci.get('rpcd', section_id, 'password') || '';
			return (value.substring(0, 3) == '$p$') ? '' : value;
		};
		
		// 비밀번호 규칙 검증 UI 추가
		o.render = function(section_id, option_index, cfgvalue) {
			var field = form.Value.prototype.render.apply(this, [section_id, option_index, cfgvalue]);
			
			// DOM 요소 접근 방식 변경
			// field가 DOM 요소가 아닐 수 있으므로 안전하게 처리
			var passwordInput = null;
			if (field && field.querySelector) {
				passwordInput = field.querySelector('input');
			} else if (field && field.children) {
				// DOM 요소를 직접 순회하여 input 찾기
				for (var i = 0; i < field.children.length; i++) {
					if (field.children[i].tagName && field.children[i].tagName.toLowerCase() === 'input') {
						passwordInput = field.children[i];
						break;
					}
				}
			}
			
			if (!passwordInput) {
				// 입력 필드를 찾을 수 없는 경우 원래 필드 반환
				return field;
			}
				
			// 비밀번호 규칙 컨테이너 생성
			var requirementsDiv = E('div', { 'class': 'requirements', 'id': 'requirements_' + section_id, 'style': 'display:none' }, [
				E('div', { 'class': 'requirement', 'id': 'length_' + section_id }, [
					E('span', {}, '✗'), ' ', _('Length between %d and %d characters').format(minLength, maxLength)
				]),
				E('div', { 'class': 'requirement', 'id': 'uppercase_' + section_id }, [
					E('span', {}, '✗'), ' ', _('Include uppercase letters')
				]),
				E('div', { 'class': 'requirement', 'id': 'lowercase_' + section_id }, [
					E('span', {}, '✗'), ' ', _('Include lowercase letters')
				]),
				E('div', { 'class': 'requirement', 'id': 'number_' + section_id }, [
					E('span', {}, '✗'), ' ', _('Include numbers')
				]),
				E('div', { 'class': 'requirement', 'id': 'special_' + section_id }, [
					E('span', {}, '✗'), ' ', _('Include special characters (!@#$%^&*())')
				])
			]);
			
			// CSS 스타일 추가
			var styleId = 'password-requirements-style';
			if (!document.getElementById(styleId)) {
				var style = E('style', { 'id': styleId }, `
					.requirements {
						margin: 10px 0;
						padding: 10px;
						border: 1px solid #ddd;
						border-radius: 4px;
						background: #f9f9f9;
						font-size: 13px;
					}
					.requirement {
						margin: 5px 0;
						line-height: 1.4;
						color: red;
					}
					.requirement.valid { 
						color: green; 
					}
					.requirement.invalid { 
						color: red; 
					}
					.error-message {
						margin: 10px 0;
						padding: 10px;
						border: 1px solid #f88;
						border-radius: 4px;
						background: #fee;
						color: #c00;
						font-size: 13px;
						line-height: 1.5;
					}
				`);
				
				if (document.head) {
					document.head.appendChild(style);
				}
			}
			
			// 비밀번호 입력 필드 이벤트 처리
			if (passwordInput && passwordInput.addEventListener) {
				passwordInput.addEventListener('focus', function() {
					var reqDiv = document.getElementById('requirements_' + section_id);
					if (reqDiv) reqDiv.style.display = 'block';
				});
				
				passwordInput.addEventListener('blur', function() {
					var reqDiv = document.getElementById('requirements_' + section_id);
					if (reqDiv) reqDiv.style.display = 'none';
				});
				
				passwordInput.addEventListener('input', function() {
					if (window.checkPassword) {
						window.checkPassword(this.value, section_id);
					}
				});
			}
			
			// 비밀번호 검증 함수
			window.checkPassword = window.checkPassword || function(value, section_id) {
				var checks = {
					length: new RegExp(`^.{${minLength},${maxLength}}$`),
					uppercase: /[A-Z]/,
					lowercase: /[a-z]/,
					number: /[0-9]/,
					special: /[!@#$%^&*()]/
				};
				
				var allValid = true;
				for (var key in checks) {
					var element = document.getElementById(key + '_' + section_id);
					if (!element) continue;
					
					var isValid = checks[key].test(value);
					element.classList.toggle('valid', isValid);
					element.classList.toggle('invalid', !isValid);
					
					var spanElement = element.querySelector('span');
					if (spanElement) {
						spanElement.textContent = isValid ? '✓' : '✗';
					}
					
					allValid = allValid && isValid;
				}
				
				return allValid;
			};
			
			// 비밀번호 규칙 컨테이너를 입력 필드 아래에 추가
			if (field && field.appendChild) {
				field.appendChild(requirementsDiv);
			}
			
			return field;
		};
		
		o.validate = function(section_id, value) {
			var variant = this.map.lookupOption('_variant', section_id)[0];

			switch (value.substring(0, 3)) {
			case '$p$':
				return _('The password may not start with "$p$".');

			case '$6$':
				variant.getUIElement(section_id).setValue('crypted');
				break;

			default:
				if (variant.formvalue(section_id) == 'crypted' && value.length && !has_openssl)
					return _('Cannot encrypt plaintext password since OpenSSL is not installed.');
					
				// 비밀번호 규칙 검증
				if (variant.formvalue(section_id) == 'crypted' && value.length) {
					var checks = {
						length: new RegExp(`^.{${minLength},${maxLength}}$`),
						uppercase: /[A-Z]/,
						lowercase: /[a-z]/,
						number: /[0-9]/,
						special: /[!@#$%^&*()]/
					};
					
					var failedRules = [];
					
					if (!checks.length.test(value))
						failedRules.push(_('Length between %d and %d characters').format(minLength, maxLength));

					if (!checks.uppercase.test(value))
						failedRules.push(_('Include uppercase letters'));
						
					if (!checks.lowercase.test(value))
						failedRules.push(_('Include lowercase letters'));
						
					if (!checks.number.test(value))
						failedRules.push(_('Include numbers'));
						
					if (!checks.special.test(value))
						failedRules.push(_('Include special characters (!@#$%^&*())'));
						
					if (failedRules.length > 0) {
						// 오류 메시지를 문자열로 반환
						return _('Password does not meet requirements:') + '\n• ' + failedRules.join('\n• ');
					}
				}
			}

			return true;
		};
		o.write = function(section_id, value) {
			var variant = this.map.lookupOption('_variant', section_id)[0];
			
			if (variant.formvalue(section_id) == 'crypted' && value.substring(0, 3) != '$6$') {
				var cmd = 'echo "' + value.replace(/"/g, '\\"') + '" | openssl passwd -6 -stdin';
				return fs.exec('/bin/sh', ['-c', cmd]).then(function(res) {
					if (res.code == 0 && res.stdout) {
						var hashedPassword = res.stdout.trim();
						uci.set('rpcd', section_id, 'password', hashedPassword);
					}
					else {
						throw new Error(res.stderr);
					}
				}).catch(function(err) {
					throw new Error(_('Unable to encrypt plaintext password: %s').format(err.message));
				});
			}
			
			uci.set('rpcd', section_id, 'password', value);
		};
		o.remove = function() {};

		o = s.option(form.Value, 'timeout', _('Session timeout'));
		o.default = '300';
		o.datatype = 'uinteger';
		o.textvalue = function(section_id) {
			var value = uci.get('rpcd', section_id, 'timeout') || this.default;
			return +value ? '%ds'.format(value) : E('em', [ _('does not expire') ]);
		};

		o = s.option(cbiACLLevel, '_read', _('Read access'));
		o.modalonly = false;

		o = s.option(cbiACLLevel, '_write', _('Write access'));
		o.modalonly = false;

		o = s.option(form.ListValue, '_level', _('Access level'));
		o.modalonly = true;
		o.value('write', _('full', 'All permissions granted'));
		o.value('read', _('readonly', 'Only read permissions granted'));
		o.value('individual', _('individual', 'Select individual permissions manually'));
		o.cfgvalue = function(section_id) {
			var readList = L.toArray(uci.get('rpcd', section_id, 'read')),
			    writeList = L.toArray(uci.get('rpcd', section_id, 'write'));

			if (writeList.length == 1 && writeList[0] == '*')
				return 'write';
			else if (readList.length == 1 && readList[0] == '*')
				return 'read';
			else
				return 'individual';
		};
		o.write = function(section_id) {
			switch (this.formvalue(section_id)) {
			case 'write':
				uci.set('rpcd', section_id, 'read', ['*']);
				uci.set('rpcd', section_id, 'write', ['*']);
				break;

			case 'read':
				uci.set('rpcd', section_id, 'read', ['*']);
				uci.unset('rpcd', section_id, 'write');
				break;
			}
		};
		o.remove = function() {};

		o = s.option(cbiACLSelect, '_acl');
		o.modalonly = true;
		o.depends('_level', 'individual');

		s.handleAdd = function() {
			// 새 계정 생성 시 호출되는 함수
			console.log('[DEBUG] handleAdd 함수 호출됨');
			
			// 모달 창이 열리기 전에 실행되는 코드
			var result = form.GridSection.prototype.handleAdd.apply(this);
			
			// 모달 창이 열린 후 실행할 코드 - 타이밍을 1초로 늘림
			setTimeout(function() {
				console.log('[DEBUG] 모달 창이 열린 후 실행');
				
				// 모달 창 자체를 찾아서 로깅
				var modal = document.querySelector('.modal');
				if (modal) {
					console.log('[DEBUG] 모달 창 찾음');
					
					// 모달 내부의 모든 입력 필드 로깅
					var allInputs = modal.querySelectorAll('input');
					console.log('[DEBUG] 모달 내 입력 필드 수:', allInputs.length);
					allInputs.forEach(function(input, index) {
						console.log('[DEBUG] 입력 필드 #' + index + ':', input.name, input);
					});
					
					// 다양한 셀렉터로 시도
					var usernameField = modal.querySelector('input[name*="username"]') || 
										modal.querySelector('input[id*="username"]') ||
										modal.querySelector('.cbi-value-field input');
					
					if (usernameField) {
						console.log('[DEBUG] 사용자 이름 필드 찾음:', usernameField);
						console.log('[DEBUG] readonly 속성:', usernameField.readOnly);
						
						// 강제로 readonly 속성 제거
						if (usernameField.readOnly) {
							console.log('[DEBUG] readonly 속성 제거');
							usernameField.readOnly = false;
						}
						
						// 추가로 disabled 속성도 제거
						if (usernameField.disabled) {
							console.log('[DEBUG] disabled 속성 제거');
							usernameField.disabled = false;
						}
					} else {
						console.log('[DEBUG] 사용자 이름 필드를 찾을 수 없음');
					}
				} else {
					console.log('[DEBUG] 모달 창을 찾을 수 없음');
				}
			}, 1000); // 1초로 타이밍 늘림
			
			return result;
		};

		s.handleSave = function() {
			return form.GridSection.prototype.handleSave.apply(this);
		};

		return m.render();
	}
});
