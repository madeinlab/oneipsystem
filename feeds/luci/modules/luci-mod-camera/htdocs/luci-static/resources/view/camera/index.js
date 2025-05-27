'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require network';
'require rpc';
'require tools.widgets as widgets';

var isReadonlyView = !L.hasViewPermission() || null;

const _debug = false;
function consoleLog(msg, ...args) {
    if (_debug) {
        console.log(msg, ...args);
    }
}

const _useRtkGswForLinkState = true;
var _pollRegistered = false
var _wanip = ''
var _oldDescriptions = {}
var _isConfigUpdating = false
var _macAddrArr = {}
var _hlsport = '8888'
var _rtspport = '10554'

var initCameraConfig = rpc.declare({
	object: 'luci',
	method: 'initCameraConfig',
	expect: { '': {} }
});

var cameraRedirect = rpc.declare({
	object: 'luci',
	method: 'cameraRedirect',
	params: [ 'ip', 'port' ],
	expect: { '': {} }
});

var rtspRedirect = rpc.declare({
	object: 'luci',
	method: 'rtspRedirect',
	params: [ 'url', 'port' ],
	expect: { '': {} }
});

var callSwconfigFeatures = rpc.declare({
	object: 'luci',
	method: 'getSwconfigFeatures',
	params: [ 'switch' ],
	expect: { '': {} }
});

var callSwconfigPortState = rpc.declare({
	object: 'luci',
	method: 'getSwconfigPortState',
	params: [ 'switch' ],
	expect: { result: [] }
});

var getCameraInfo = rpc.declare({
    object: 'luci',
    method: 'getCameraInfo',
    params: [ 'section_id', 'type' ]
});

var callRebootCamera = rpc.declare({
	object: 'luci',
	method: 'rebootCamera',
	params: [ 'ip', 'mac' ]	
});

var getLinkState = rpc.declare({
	object: 'luci',
	method: 'getLinkState',
	params: [ ]
});

var setCameraConfig = rpc.declare({
	object: 'luci',
	method: 'setCameraConfig',
	params: [ 'section', 'option', 'value']
});

var callEncryptPassword = rpc.declare({
	object: 'luci',
	method: 'encryptPassword',
	params: [ 'password'],
	expect: { result: "" } 
});

var updateRTSPProxyConf = rpc.declare({
	object: 'luci',
	method: 'updateRTSPProxyConf',
	params: []
});

var updateAccountsConf = rpc.declare({
	object: 'luci',
	method: 'updateAccountsConf',
	params: []
});

var addCamera = rpc.declare({
	object: 'luci',
	method: 'addCamera',
	params: [ 'ip', 'mac', 'username', 'password' ]
});

var callGetMacAddr = rpc.declare({
	object: 'luci',
	method: 'getMacAddr',
	params: [ ]
});

var callSaveAccountConf = rpc.declare({
	object: 'luci',
	method: 'saveAccountConf',
	params: [ 'mac', 'username', 'password' ]
});

var callGetAccountByMac = rpc.declare({
	object: 'luci',
	method: 'getAccountByMac',
	params: [ 'mac' ]
});

// 복호화 함수. 
// 웹브라우저 개발자모드에서 코드 노출을 막기 위해 주석처리.
// 터미널에서 복화화 함수 확인. 
// ubus call luci decryptPassword '{ "password":"U2FsdGVkX1/H+CUTc8Ys+UUmY7fe385mKP0HB7HUY1s=" }'
//
// var callDecryptPassword = rpc.declare({
// 	object: 'luci',
// 	method: 'decryptPassword',
// 	params: [ 'password'],
// 	expect: { result: "" } 
// });

const ipMap = {
  cam1: "209.142.67.10",
  cam2: "209.142.67.20",
  cam3: "209.142.67.30",
  cam4: "209.142.67.40",
  cam5: "209.142.67.50",
  cam6: "209.142.67.60",
  cam7: "209.142.67.70",
  cam8: "209.142.67.80"
};

function render_port_status(type, node, portstate) {
	if (!node) {
		console.log("render_port_status node is null")
		return null;
	}

	let imgSrc
	if (type == "rtk_gsw") {
		imgSrc = !portstate ? L.resource('icons/circle_red.png') : L.resource('icons/circle_green.png');
	} else {
		imgSrc = (!portstate || !portstate.link) ? L.resource('icons/circle_red.png') : L.resource('icons/circle_green.png');
	}

    dom.content(node, [E('img', { src: imgSrc })]);

	return node;
}

async function updateStatusAndCamera(topologies) {
	var today = new Date();
	consoleLog('[debug] updateStatusAndCamera %s', today)

	try {
		let tasks = [];
		let states = [];
		
		_macAddrArr = await callGetMacAddr()
		// for (let i=0; i<8; i++) {
		// 	console.log(String.format("mac[%d][%s]", i, _macAddrArr[i]))
		// }

		for (var switch_name in topologies)
			tasks.push(callSwconfigPortState(switch_name).then(L.bind(function(switch_name, portstate) {
				consoleLog('[debug] portstate ', portstate)
				for (var i = 0; i < (portstate.length - 1); i++) {
					var cameraNodes = document.querySelectorAll('[data-camera-port="%d"]'.format(portstate[i].port + 1));
					consoleLog('[debug] cameraNodes.length ', cameraNodes.length)
					for (var j = 0; j < cameraNodes.length; j++) {
						render_port_status("topology", cameraNodes[j], portstate[i]);
						states.push({state: portstate[i].link}); 
					}
				}
				updateCameraInfo(states)
			}, topologies[switch_name], switch_name)));

        // Update camera's info
        //tasks.push(Promise.resolve().then(() => updateCameraInfo(state)));
        
        await Promise.all(tasks);
	} catch (error) {
        console.log("Error in updateStatusAndCamera: ", error);
    }

    consoleLog('[debug] updateStatusAndCamera END');
}

// Update camera info
async function updateCameraInfo(portstate) {
	var today = new Date();
	consoleLog('[debug] updateCameraInfo %s %s', today, portstate)

	try {
		if (typeof uci.load === 'function') {
			_isConfigUpdating = true
			try {
				uci.unload('camera');
				await uci.load('camera');
			} finally {
				_isConfigUpdating = false;
			}
		}

		var cameraSections = uci.sections('camera');
		cameraSections.forEach(function(section) {
			var section_id = section['.name'];
			var switchport = parseInt(uci.get('camera', section_id, 'switchPort'), 10)
			if (isNaN(switchport)) switchport = 0
			var state = switchport === 0 ? false : portstate[switchport - 1].state
            var ip = state ? (uci.get('camera', section_id, 'ip') || '') : ''
            var model = state ? (uci.get('camera', section_id, 'model') || '') : ''
            var manufacturer = state ? (uci.get('camera', section_id, 'manufacturer') || '') : ''
			var description = state ? (uci.get('camera', section_id, 'description') || '') : ''
            var rtsp = state ? (uci.get('camera', section_id, 'rtsp') || '') : ''
            var selectedRtsp = uci.get('camera', section_id, 'selectedrtsp')
            var port = uci.get('camera', section_id, 'rtspForwardingPort');
			var switch_port  = uci.get('camera', section_id, 'switchPort');

			// DOM
            var modelElement = document.querySelector(`div[data-camera-id="${section_id}"].model`);
            var manufacturerElement = document.querySelector(`div[data-camera-id="${section_id}"].manufacturer`);
			var descriptionElement = document.querySelector(`#cbi-camera-${section_id}-desc input`);
			var rtspElement = document.querySelector(`#cbi-camera-${section_id}-rtsplist`);
			var hiddenrtspElement = document.querySelector(`#cbi-camera-${section_id}-rtsplist input[type="hidden"]`);
            var rowElement = document.querySelector(`tr[data-sid="${section_id}"]`);

			var strRtsp;
			if (Array.isArray(rtsp)) {
				strRtsp = rtsp.join(',');
			} else if (typeof rtsp === 'string') {
				strRtsp = rtsp;
			} else {
				console.error('Unexpected rtsp type:', typeof rtsp);
				strRtsp = String(rtsp);
			}
			
			const wrapper = document.querySelector(`#cbi-camera-${section_id}-account`);
			if (!wrapper) return;
		
			const oldBtn = wrapper.querySelector('.cbi-button-set');
			if (oldBtn) oldBtn.remove();
		
			//const newBtn = createButton(section_id, 'Set', 'cbi-button-set', 'set', ip != '' ? true : false);
			const newBtn = createButton(section_id, 'Set', 'cbi-button-set', 'set', state);
			wrapper.appendChild(newBtn);

			// description
			if (_oldDescriptions[section_id] !== description) {
				descriptionElement.value = description
				_oldDescriptions[section_id] = description
			}

			// rtsp list
			if (hiddenrtspElement && hiddenrtspElement.value !== strRtsp) {
                hiddenrtspElement.value = rtsp;

				// RTSP list
				if (rtspElement) {
					var selectElement = rtspElement ? rtspElement.querySelector('select') : null;
					if (!selectElement) {
						selectElement = document.createElement('select');
						selectElement.id = `widget.cbid.camera.${section_id}.rtsplist`;
						selectElement.className = 'cbi-input-select';
						rtspElement.appendChild(selectElement);
					}
					
					selectElement.innerHTML = '';

					if (!Array.isArray(rtsp)) {
						rtsp = rtsp ? [rtsp] : [];
					}

					rtsp.forEach(function(item) {
						var option = document.createElement('option');
						option.value = item;

						// used with ffmpeg
						// var match = item.match(/rtsp:\/\/[^\/]+\/(.+)/);
						// option.textContent = port && item && match
						// 	? String.format("rtsp://%s:%d/%s", _wanip, port, match[1])
						// 	: item;

						if (typeof item === 'string' && item.trim() !== '') {
							const segments = item.split('/');
							const profileName = segments[segments.length - 1];

							// ex) rtsp://192.168.1.100:10554/camera/2/Profile1
							option.textContent = String.format(
								"rtsp://%s:%d/camera/%s/%s",
								_wanip,
								_rtspport,
								switch_port,
								profileName
							);
						} else {
							option.textContent = item || '';
						}

						if (item === selectedRtsp) {
							option.selected = true;
						}

						selectElement.appendChild(option);
					});
				
					selectElement.addEventListener('change', function() {
						uci.set('camera', section_id, 'selectedrtsp', selectElement.value);
						uci.save()
					});

					if (!rtspElement.contains(selectElement)) {
						rtspElement.appendChild(selectElement);
					}
				}
            }

			// buttons
			if (rowElement) {
				var isIpValid = ip && ip.trim() !== '';
				var actionCell = rowElement.querySelector('.cbi-section-actions');
				if (actionCell) {
					actionCell.innerHTML = '';
					//['webpage', 'streaming', 'reboot', 'set'].forEach(function(action) {
					['webpage', 'streaming', 'reboot'].forEach(function(action) {
						var btnOption = {
							title: _(action.charAt(0).toUpperCase() + action.slice(1)),
							class: `cbi-button cbi-button-${action}`,
							click: handleButtonClick.bind(this, section_id, action),
						}
						if (!isIpValid) btnOption.disabled = true;	

						var btn = E('button', btnOption, [_(action.charAt(0).toUpperCase() + action.slice(1))]);	
						dom.append(actionCell, btn);
					});
				}
			}
		});
	} catch (error) {
        console.error('Error in updateCameraInfo:', error);
    }

    consoleLog('[debug] updateCameraInfo END');
}

async function getRtkGswLinkState() {
    try {
        const { result } = await getLinkState();
        return Array.from(result);
    } catch (error) {
        console.error("RPC call failed:", error);
        return null;
    }
}

async function handleButtonClick(section_id, type) {
	consoleLog("[debug] handleButtonClick section_id[%s] type[%s]", section_id, type)

	if (type === 'reboot') {
		if (!confirm(_('Do you want to reboot the camera?')))
			return;

		let ip = uci.get('camera', section_id, 'ip') || ''
		let mac = uci.get('camera', section_id, 'mac') || ''

		if (ip !== '' && mac !== '')
			callRebootCamera(ip, mac);

		return
	}

	if (type == 'set') {
		handleSetCameraLoginInfo(section_id)
		return
	}

	let url = ''
	if (type === 'webpage') {
		let port
		try {
			const info = await getCameraInfo(section_id, type)
			port = parseInt(info.port, 10)

			if (!_wanip || isNaN(port)) {
				throw new Error("Invalid WAN IP or Port");
			}
		} catch (err) {
			console.error("[error] Failed to get camera info:", err);
			return
		}

		url = `https://${_wanip}:${port}`
	} else if (type === 'streaming') {
		var select_rtsp = uci.get('camera', section_id, 'selectedrtsp');
		var switch_port = uci.get('camera', section_id, 'switchPort');
		if (!select_rtsp || !switch_port) {
			console.error("Missing RTSP or switch_port info");
			return;
		}

		// used with mediamtx
		const segments = select_rtsp.split('/');
		const profileName = segments[segments.length - 1];
		
		// ex) rtsp://192.168.1.100:10554/camera/2/Profile1
		url = String.format(
			"http://%s:%d/camera/%s/%s",
			_wanip,
			_hlsport,
			switch_port,
			profileName
		);

		// used with ffmpeg
		// url = `https://${_wanip}:${port}/hls/`
	}

	if (url !== '') {
		consoleLog("[debug] Opening URL:", url);
		window.open(url, '_blank');
	}
}

async function saveCameraUserAccount(mac, username, password) {
	// console.log("saveCameraUserAccount mac:%s", mac)
	if (typeof mac == 'string' && mac.trim() !== '' && mac.trim() !== "00:00:00:00:00:00")
		callSaveAccountConf(mac, username, password)
}

async function handleSetCameraLoginInfo(section_id) {
	let portStr = uci.get('camera', section_id, 'switchPort');
	let portNum = Number(portStr);
	let mac = uci.get('camera', section_id, 'mac') ? uci.get('camera', section_id, 'mac') : _macAddrArr[portNum - 1]

	callGetAccountByMac(mac).then(function(account) {
		let user = account.username || ''
		let pass = account.password || ''
		// console.log("camera mac[%s] username[%s] password[%s]", mac, user, pass)

		let hasAccount = (user !== '' && pass !== '') ? true : false

		// 카메라 계정 설정 모달창
		ui.showModal(`${_('Camera')} ${portStr}`, [
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-node' }, [
					E('p', _('Enter the username and password for Camera %d.').replace('%d', portStr)),

					// E('div', { 'class': 'cbi-value' }, [
					// 	E('label', { 'class': 'cbi-value-title', 'for': 'set-user-flag' }, _('Set Login Info')),
					// 	E('div', { 'class': 'cbi-value-field' }, [
					// 		E('input', {
					// 			'type': 'checkbox',
					// 			'id': 'set-user-flag',
					// 			//'checked': uci.get('camera', section_id, 'set_user') === '1',
					// 			'click': function () {
					// 				// 체크 상태에 따라 관련 필드 show/hide
					// 				const checked = this.checked;
					// 				document.querySelectorAll('.user-info-field').forEach(el => {
					// 					el.style.display = checked ? '' : 'none';
					// 				});
					// 			}
					// 		})
					// 	])
					// ]),

					// E('p', {
					// 	'class': 'user-info-field',
					// 	'style': msgStyle + ' font-size: 14px; font-style: italic;'
					// }, 
					// 	hasAccount
					// 		? _('Saved credentials exist.') 
					// 		: _('No saved credentials.')
					// ),

					//E('div', { 'class': 'cbi-value user-info-field', 'style': uci.get('camera', section_id, 'set_user') === '1' ? '' : 'display: none;' }, [
					E('div', { 'class': 'cbi-value user-info-field' }, [
						E('label', { 'class': 'cbi-value-title', 'for': 'camera-id' }, _('Username')),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', { 
								'class': 'cbi-input-text', 
								'id': 'camera-id', 
								// 'type': 'password', 
								'placeholder': _('Enter Camera Username'),
								'value': user
							})
						])
					]),

					//E('div', { 'class': 'cbi-value user-info-field', 'style': uci.get('camera', section_id, 'set_user') === '1' ? '' : 'display: none;' }, [
					E('div', { 'class': 'cbi-value user-info-field' }, [
						E('label', { 'class': 'cbi-value-title', 'for': 'camera-pw' }, _('Password')),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', { 
								'class': 'cbi-input-text', 
								'id': 'camera-pw', 
								'type': 'password', 
								'placeholder': _('Enter Camera Password'),
								'value': ''
							})
						])
					]),

					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn cbi-button',
							'click': function() {
								ui.hideModal();
							}
						}, _('Cancel')),
						E('button', {
							'class': 'btn cbi-button-action important',
							'click': async function() {
								let newUser = document.getElementById('camera-id').value || ''
								let newPassword = document.getElementById('camera-pw').value || ''

								let encrypted = newPassword
								if (encrypted !== '') {
									encrypted = await callEncryptPassword(newPassword)
									if (!encrypted) {
										console.error("Encryption failed or returned empty value");
										encrypted = ''
									}
								}

								if (newUser !== '' && encrypted !== '') {
									saveCameraUserAccount(mac, newUser, encrypted);
								}
								
								ui.hideModal();
							}
						}, _('Save'))
					])
				])
			])
		]);
	});

	var modal = document.querySelector('.modal');
	if (modal) {
		modal.style.width = '600px';
		modal.style.maxWidth = '60%';
    }
}

function createButton(section_id, label, cssClass, action, isIpValid) {
	var opts = {
		'title': _(label),
		'class': 'cbi-button ' + cssClass,
		'click': handleButtonClick.bind(this, section_id, action)
	};
	if (!isIpValid) opts.disabled = true;

	return E('button', opts, [_(label)]);
}

return view.extend({
	load: function() {
		var tasks = [];
		tasks.push(uci.load('camera'))
		tasks.push(network.getWANNetworks())
		if (_useRtkGswForLinkState) {
			tasks.push(getRtkGswLinkState())
			tasks.push(callGetMacAddr())
			return Promise.all(tasks)
			//return getRtkGswLinkState();
		} else {
			var i = 0
			return network.getSwitchTopologies().then(function(topologies) {
				for (var switch_name in topologies) {
					tasks.push(callSwconfigPortState(switch_name).then(L.bind(function(ports) {
						this.portstate = ports;
					}, topologies[switch_name])));
				}
				return Promise.all(tasks).then(function() { return topologies });
			});
		}
	},

	// switchSections.length: 1
	// switch_name: switch0
	// topologies[switch0].legnth: 6 (Port1, Port2, Port3, Port4, Port5, CPU(eth0))	
	//render: function(topologies) { // org
	render: function(data) {
		let wan_nets  = data[1]
		for (let i = 0; i < wan_nets.length; i++) {
			if (wan_nets[i].sid === 'wan') {
				_wanip = wan_nets[i].getIPAddr()
				break
			}
		}

		var m, s, o

		let topologies = _useRtkGswForLinkState ? null : data[2]
		let linkstate = _useRtkGswForLinkState ? data[2] : null

		_macAddrArr = data[3] ? data[3] : {}
		// for (let i=0; i<8; i++) {
		// 	console.log(String.format("mac[%d][%s]", i, _macAddrArr[i]))
		// }

		consoleLog('linkstate[%s]\ntopologies[%s] ', linkstate, topologies)

		m = new form.Map('camera')

		var switch_name = 'switch0'
		if (!topologies) {
			topologies = {};
		}

		var topology = topologies[switch_name];
		if (!topology) {
			topologies[switch_name] = topology = {
				portstate: [
					{ link: false, port: 0 },
					{ link: false, port: 1 },
					{ link: false, port: 2 },
					{ link: false, port: 3 },
					{ link: false, port: 4 },
					{ link: false, port: 5 },
					{ link: false, port: 6 },
					{ link: false, port: 7 }
				]
			};
		}
		consoleLog('[debug] topology:', topology);

		s = m.section(form.TableSection, 'camera', null)
		s.anonymous = true
		s.addremove = false
		s.topology = topology;
		s.linkstate = linkstate;

		o = s.option(form.DummyValue, 'switchPort', _('Port'))
		o.datatype = "string"
		o.readonly = true

		o = s.option(form.DummyValue, 'account', _('Camera Account'))
		o.rawhtml = true
		o.cfgvalue = function(section_id) {
			var ip = uci.get('camera', section_id, 'ip');
			// var isIpValid = ip && ip.trim() !== '';		
			// return createButton.call(this, section_id, 'Set', 'cbi-button-set', 'set', isIpValid)

			let type, port_num, portstate

			type = _useRtkGswForLinkState ? "rtk_gsw" : "topology"

			port_num = parseInt(uci.get('camera', section_id, 'switchPort'), 10)
			if (isNaN(port_num))
				portstate = false
			else {
				if (_useRtkGswForLinkState) {
					portstate = Array.isArray(linkstate) ? 
						(parseInt(linkstate[port_num - 1], 10) == 1 ? true : false)
						: false
				} else {
					portstate = Array.isArray(topology.portstate) ? topology.portstate[port_num - 1] : null
				}
			}

			return createButton.call(this, section_id, 'Set', 'cbi-button-set', 'set', portstate)
		}
		o.write = function(section_id, value) {

		}

		o = s.option(form.Value, 'desc', _('Description'))
		o.datatype = "string"
		o.maxlength = 8
		o.renderWidget = function(section_id, option_id, cfgvalue) {
			var container = E('div', {});
			
			var wrapper = document.createElement('div');
			wrapper.style.display = 'flex';
			wrapper.style.alignItems = 'center';
			wrapper.style.gap = '5px';

			var descriptionElement = document.createElement('input');
			descriptionElement.type = 'text';
			descriptionElement.style.minWidth = '80px';
			descriptionElement.style.maxWidth = '160px';
			descriptionElement.style.width = '100%';
			descriptionElement.maxLength = 8;
		
			var description = uci.get('camera', section_id, 'ip') ? (uci.get('camera', section_id, 'description') || '') : '';
			descriptionElement.value = description;
			_oldDescriptions[section_id] = description

			descriptionElement.addEventListener('change', function() {
				uci.set('camera', section_id, 'description', descriptionElement.value);
			});

			wrapper.appendChild(descriptionElement);

			container.appendChild(wrapper);

			o.cfgvalue = function() {
				return descriptionElement.value;
			};

			return container;
		}

		o = s.option(form.ListValue, 'rtsplist', 'RTSP');
		o.renderWidget = function(section_id, option_id, cfgvalue) {
			consoleLog("[debug]Rendering for section_id: %s", section_id);
		
			var container = E('div', {});

			var wrapper = document.createElement('div');
			wrapper.style.display = 'flex';
			wrapper.style.alignItems = 'center';
			wrapper.style.gap = '5px';

			var selectElement = document.createElement('select');
			selectElement.id = 'widget.cbid.camera.' + section_id + '.rtsplist';
			selectElement.className = 'cbi-input-select';
			selectElement.style.minWidth = '250px';
		
			var rtsp = uci.get('camera', section_id, 'rtsp');
			var selectedrtsp = uci.get('camera', section_id, 'selectedrtsp');
			var port = uci.get('camera', section_id, 'rtspForwardingPort');
			var switch_port  = uci.get('camera', section_id, 'switchPort');
		
			if (!Array.isArray(rtsp)) {
				rtsp = rtsp ? [rtsp] : [];
			}
		
			if (!selectedrtsp || !rtsp.includes(selectedrtsp)) {
				selectedrtsp = rtsp[0];
			}

			rtsp.forEach(function(rtsp) {
				var option = document.createElement('option');
				option.value = rtsp;

				// used with ffmpeg
				// if (rtsp && port) {
				// 	option.textContent = String.format("rtsp://%s:%d/%s", _wanip, port, rtsp.match(/rtsp:\/\/[^\/]+\/(.+)/)[1])
				// } else {
				// 	option.textContent = rtsp;
				// }

				// used with mediamtx]
				if (typeof rtsp === 'string' && rtsp.trim() !== '') {
					const segments = rtsp.split('/');
					const profileName = segments[segments.length - 1];

					// ex) rtsp://192.168.1.100:10554/camera/2/Profile1
					option.textContent = String.format(
						"rtsp://%s:%d/camera/%s/%s",
						_wanip,
						_rtspport,
						switch_port,
						profileName
					);
				} else {
					option.textContent = rtsp || '';
				}

				if (rtsp === selectedrtsp) {
					option.selected = true;
				}
		
				selectElement.appendChild(option);
			});

			var copyButton = E('button', {
				'style': 'background: none; border: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px;',				
				'click': function() {
					try {
						if (!selectElement || !selectElement.options || selectElement.selectedIndex < 0) {
							return;
						}
						
						var selectedText = selectElement.options[selectElement.selectedIndex].textContent;
						if (selectedText) {
							navigator.clipboard.writeText(selectedText).then(function() {
								alert('Copied: ' + selectedText);
							}).catch(function(err) {
								console.error('Failed to copy:', err);
							});
						}
					} catch (err) {
						console.error('Unexpected error:', err);
					}					
				}
			}, [
				E('img', { 'src': L.resource('icons/copy.png'), 'style': 'width:16px; height:16px;' })
			]);

			selectElement.addEventListener('change', function() {
				uci.set('camera', section_id, 'selectedrtsp', selectElement.value);
				uci.save()
			});

			var strRtsp;
			if (Array.isArray(rtsp)) {
				strRtsp = rtsp.join(',');
			} else if (typeof rtsp === 'string') {
				strRtsp = rtsp;
			} else {
				console.error('Unexpected rtsp type:', typeof rtsp);
				strRtsp = String(rtsp);
			}

			// hidden for rtsp value
			var hiddenInput = E('input', {
				type: 'hidden',
				name: option_id,
				value: strRtsp
			});

			wrapper.appendChild(selectElement);
			wrapper.appendChild(copyButton);
			wrapper.appendChild(hiddenInput);

			container.appendChild(wrapper);

			return container;
		};

		o = s.option(form.DummyValue, "status", _('Status'))
		o.datatype = "string"
		o.readonly = true
		o.renderWidget = function(section_id, option_id, cfvalue) {			
			let type, port_num, portstate

			type = _useRtkGswForLinkState ? "rtk_gsw" : "topology"

			port_num = parseInt(uci.get('camera', section_id, 'switchPort'), 10)
			if (isNaN(port_num))
				portstate = false
			else {
				if (_useRtkGswForLinkState) {
					portstate = Array.isArray(linkstate) ? 
						(parseInt(linkstate[port_num - 1], 10) == 1 ? true : false)
						: false
				} else {
					portstate = Array.isArray(topology.portstate) ? topology.portstate[port_num - 1] : null
				}
			}

			var container = E('div', {});	

			let statusNode = E('small', {
				'data-camera-port': port_num
			});

			render_port_status(type, statusNode, portstate)

			container.appendChild(statusNode);

			return container;
		}

		s.renderRowActions = function(section_id) {
			var ip = uci.get('camera', section_id, 'ip');
			var tdEl = E('td', {
				'class': 'td cbi-section-table-cell nowrap cbi-section-actions'
			}, E('div'));
			var isIpValid = ip && ip.trim() !== '';

			dom.append(tdEl.lastElementChild, createButton.call(this, section_id, 'Webpage', 'cbi-button-webpage', 'webpage', isIpValid));
			dom.append(tdEl.lastElementChild, createButton.call(this, section_id, 'Streaming', 'cbi-button-streaming', 'streaming', isIpValid));
			dom.append(tdEl.lastElementChild, createButton.call(this, section_id, 'Reboot', 'cbi-button-reboot', 'reboot', isIpValid));
			//dom.append(tdEl.lastElementChild, createButton.call(this, section_id, 'Set', 'cbi-button-set', 'set', isIpValid));

			return tdEl;
		};

		if (!_pollRegistered) {
			_pollRegistered = true
			setTimeout(() => {
				poll.add(L.bind(updateStatusAndCamera, m, topologies));
			}, 1000);
		}	

		var initialUI = m.render();

		return initialUI;
	},

	handleReset: null,
	handleSave: function(ev) {
		if (_isConfigUpdating) {
			console.warn('Configuration is being updated. Save operation is temporarily disabled.');
			return Promise.resolve();
		}

		var tasks = [];

		document.getElementById('maincontent')
			.querySelectorAll('.cbi-map').forEach(function(map) {
				tasks.push(DOM.callClassMethod(map, 'save'));
			});

		return Promise.all(tasks);
	},
	handleSaveApply: function(ev, mode) {
		if (_isConfigUpdating) {
			console.warn('Configuration is being updated. Save/Apply operations are temporarily disabled.');
			return Promise.resolve();
		}

		return this.handleSave(ev).then(function() {
			classes.ui.changes.apply(mode == '0');
		});
	}
});
