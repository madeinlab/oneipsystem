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

const debug = false;
function consoleLog(msg, ...args) {
    if (debug) {
        console.log(msg, ...args);
    }
}

function render_port_status(node, portstate) {
	if (!node) {
		console.log("render_port_status node is null")
		return null;
	}

	if (!portstate || !portstate.link)
		dom.content(node, [
			E('img', { src: L.resource('icons/circle_red.png') })
		]);
	else
		dom.content(node, [
			E('img', { src: L.resource('icons/circle_green.png') })
		]);

	return node;
}

function update_port_status(topologies) {
	var today = new Date();
	consoleLog('[debug] update_port_status %s', today)

	var tasks = [];

	for (var switch_name in topologies)
		tasks.push(callSwconfigPortState(switch_name).then(L.bind(function(switch_name, portstate) {
			consoleLog('[debug] portstate ', portstate)
			for (var i = 0; i < (portstate.length - 1); i++) {
				var cameraNodes = document.querySelectorAll('[data-camera-port="%d"]'.format(portstate[i].port + 1));
				for (var j = 0; j < cameraNodes.length; j++) {
					render_port_status(cameraNodes[j], portstate[i]);
				}
			}
		}, topologies[switch_name], switch_name)));

	return Promise.all(tasks);
}

async function handleButtonClick(section_id, type) {
	consoleLog("[debug] handleButtonClick section_id[%s] type[%s]", section_id, type)

	let wanip, port

	try {
		const info = await getCameraInfo(section_id, type)
		consoleLog("[debug] handleButtonClick > getCameraInfo wanip[%s] port[%s]", info.wanip, info.port)

		wanip = info.wanip
		port = parseInt(info.port, 10)

		if (!wanip || isNaN(port)) {
			throw new Error("Invalid WAN IP or Port");
		}
	} catch (err) {
		console.error("[error] Failed to get camera info:", err);
		return
	}

	const url = (type === 'webpage')
		? `https://${wanip}:${port}`
		: `https://${wanip}:${port}/hls/`

	consoleLog("[debug] Opening URL:", url);
	window.open(url, '_blank');
}

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

return view.extend({

	load: function() {
		var i = 0
		return network.getSwitchTopologies().then(function(topologies) {
			
			var tasks = [];

			for (var switch_name in topologies) {
				tasks.push(callSwconfigPortState(switch_name).then(L.bind(function(ports) {
					this.portstate = ports;
				}, topologies[switch_name])));
			}

			return Promise.all(tasks).then(function() { return topologies });
		});
	},

	// switchSections.length: 1
	// switch_name: switch0
	// topologies[switch0].legnth: 6 (Port1, Port2, Port3, Port4, Port5, CPU(eth0))	
	render: function(topologies) {
		var m, s, o

		m = new form.Map('camera')

		var switch_name = 'switch0'
		if (!topologies) {
			topologies = {};
		}
		//var topology = topologies ? topologies[switch_name] : null;
		var topology = topologies[switch_name];
		if (!topology) {
			// ui.addNotification(null, _('Switch %q has an unknown topology - the VLAN settings might not be accurate.').replace(/%q/, switch_name)); UI ��ܿ� �����޽��� ���

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

		o = s.option(form.DummyValue, 'switchPort', _('Port'))
		o.datatype = "string"
		o.readonly = true

		o = s.option(form.DummyValue, 'model', _('Model name'))
		o.datatype = "string"
		o.readonly = true
		o.cfgvalue = function(section_id) {
			var model = uci.get('camera', section_id, 'ip') ? uci.get('camera', section_id, 'model') : '-'

			return E('div', { 'data-camera-id': section_id, 'class': 'model' }, model);
		};

		o = s.option(form.DummyValue, 'manufacturer', _('Manufacturer'))
		o.datatype = "string"
		o.readonly = true
		o.cfgvalue = function(section_id) {
			var manufacturer = uci.get('camera', section_id, 'ip') ? uci.get('camera', section_id, 'manufacturer') : '-'

			return E('div', { 'data-camera-id': section_id, 'class': 'manufacturer' }, manufacturer);
		};

		// o = s.option(form.DummyValue, "rtsp", _('RTSP Url'))
		// o.datatype = "string"
		// o.readonly = true
		// o.cfgvalue = L.bind(function(section_id) {
		// 	var port, rtspUrl
		// 	if (uci.get('camera', section_id, 'ip')) {
		// 		port = uci.get('camera', section_id, 'rtspForwardingPort')
		// 		rtspUrl = `rtsp://${wanIP}:${port}`
		// 	} else {
		// 		rtspUrl = '-'
		// 	}

		// 	return E('div', { 'data-camera-id': section_id, 'class': 'rtsp' }, rtspUrl);
		// });

		//>> Profiles dropdown.
		o = s.option(form.ListValue, 'rtsp');
		o.renderWidget = function(section_id, option_id, cfgvalue) {
			console.log("Rendering for section_id: " + section_id);
		
			var selectElement = document.createElement('select');
			selectElement.id = 'widget.cbid.camera.' + section_id + '.rtsp';
			selectElement.className = 'cbi-input-select';
		
			var rtsp = uci.get('camera', section_id, 'rtsp');
			var selectedrtsp = uci.get('camera', section_id, 'selectedrtsp');
			var port = uci.get('camera', section_id, 'rtspForwardingPort');
		
			if (!Array.isArray(rtsp)) {
				rtsp = [rtsp];
			}
		
			if (!selectedrtsp || !rtsp.includes(selectedrtsp)) {
				selectedrtsp = rtsp[0];
			}

			rtsp.forEach(function(rtsp, index) {
				var option = document.createElement('option');
				option.value = rtsp;
				if (rtsp && port) {
					option.textContent = "rtsp://192.168.1.100:" + port + "/" + rtsp.match(/rtsp:\/\/[^\/]+\/(.+)/)[1];
				} else {
					option.textContent = rtsp;
				}
		
				if (rtsp === selectedrtsp) {
					option.selected = true;
				}
		
				selectElement.appendChild(option);
			});
		
			selectElement.addEventListener('change', function() {
				var newRtspValue = selectElement.value;
				uci.set('camera', section_id, 'selectedrtsp', newRtspValue);
				uci.save();
				uci.apply();
			});

			return selectElement;
		};

		o = s.option(form.DummyValue, "status", _('Status'))
		o.datatype = "string"
		o.readonly = true
		o.cfgvalue = L.bind(function(section_id) {
			var portstate
			var port_num = parseInt(uci.get('camera', section_id, 'switchPort'), 10)
			if (isNaN(port_num))
				portstate = false
			else {
				portstate = Array.isArray(topology.portstate) ? topology.portstate[port_num - 1] : null
			}

			var statusNode = E('small', {
				'data-camera-port': port_num
			});
		
			return render_port_status(statusNode, portstate)
		})
		
		s.renderRowActions = function(section_id) {
			var ip = uci.get('camera', section_id, 'ip');

			var tdEl = E('td', {
				'class': 'td cbi-section-table-cell nowrap cbi-section-actions'
			}, E('div'));

			var isIpValid = ip && ip.trim() !== '';
			if (isIpValid) {

				dom.append(tdEl.lastElementChild,
					E('button', {
						'title': _('Webpage'),
						'class': 'cbi-button cbi-button-webpage',
						'click': handleButtonClick.bind(this, section_id, 'webpage')
					}, [ _('Webpage') ])
				);
				
				dom.append(tdEl.lastElementChild,
					E('button', {
						'title': _('Hls'),
						'class': 'cbi-button cbi-button-rtsp',
						'click': handleButtonClick.bind(this, section_id, 'hls')
					}, [ _('Hls') ])
				);
			}

			return tdEl;
		};
		
		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
