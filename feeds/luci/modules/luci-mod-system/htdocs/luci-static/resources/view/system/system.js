'use strict';
'require view';
'require poll';
'require ui';
'require uci';
'require rpc';
'require form';
'require tools.widgets as widgets';

var callInitList, callInitAction, callTimezone,
    callGetLocaltime, callSetLocaltime, CBILocalTime;

callInitList = rpc.declare({
	object: 'luci',
	method: 'getInitList',
	params: [ 'name' ],
	expect: { '': {} },
	filter: function(res) {
		for (var k in res)
			return +res[k].enabled;
		return null;
	}
});

callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

callGetLocaltime = rpc.declare({
	object: 'system',
	method: 'info',
	expect: { localtime: 0 }
});

callSetLocaltime = rpc.declare({
	object: 'luci',
	method: 'setLocaltime',
	params: [ 'localtime' ],
	expect: { result: 0 }
});

callTimezone = rpc.declare({
	object: 'luci',
	method: 'getTimezones',
	expect: { '': {} }
});

// 자바스크립트의 Date 객체는 기본적으로 실행 환경(브라우저 또는 Node.js)의 로컬 타임존을 자동 적용해서 Epoch 시간을 변환
function formatTime(epoch) {
	var date = new Date(epoch * 1000);

	return '%04d-%02d-%02d %02d:%02d:%02d'.format(
		// UTC
		// date.getUTCFullYear(),
		// date.getUTCMonth() + 1,
		// date.getUTCDate(),
		// date.getUTCHours(),
		// date.getUTCMinutes(),
		// date.getUTCSeconds()

		// localtime
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
	);
}

CBILocalTime = form.DummyValue.extend({
	renderWidget: function(section_id, option_id, cfgvalue) {
		return E([], [
			E('input', {
				'id': 'localtime',
				'type': 'text',
				'readonly': true,
				'value': formatTime(cfgvalue)
			}),
			// E('br'),
			// E('span', { 'class': 'control-group' }, [
			// 	E('button', {
			// 		'class': 'cbi-button cbi-button-apply',
			// 		'click': ui.createHandlerFn(this, function() {
			// 			console.log("#001 callSetLocaltime ", Math.floor(Date.now() / 1000))
			// 			return callSetLocaltime(Math.floor(Date.now() / 1000));
			// 		}),
			// 		'disabled': (this.readonly != null) ? this.readonly : this.map.readonly
			// 	}, _('Sync with browser')),
			// 	' ',
			// 	this.ntpd_support ? E('button', {
			// 		'class': 'cbi-button cbi-button-apply',
			// 		'click': ui.createHandlerFn(this, function() {
			// 			console.log("#002 callInitAction")
			// 			return callInitAction('sysntpd', 'restart');
			// 		}),
			// 		'disabled': (this.readonly != null) ? this.readonly : this.map.readonly
			// 	}, _('Sync with NTP-Server')) : ''
			// ])
		]);
	},
});

return view.extend({
	load: function() {
		return Promise.all([
			//callInitList('sysntpd'),
			callInitList('chronyd'),
			callTimezone(),
			callGetLocaltime(),
			uci.load('luci'),
			uci.load('system'),
			uci.load('chrony')
		]);
	},

	render: function(rpc_replies) {
		var ntpd_enabled = rpc_replies[0],
		    timezones = rpc_replies[1],
		    localtime = rpc_replies[2],
		    m, s, o;

		m = new form.Map('system');
		m.chain('luci');
		m.chain('chrony')

		s = m.section(form.TypedSection, 'system', _('System Properties'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('time', _('Time Settings'));
		s.tab('logging', _('Log Settings'));
		//s.tab('timesync', _('Time Synchronization'));
		//s.tab('language', _('Language and Style')); // not used

		/*
		 * System Properties
		 */

		o = s.taboption('time', CBILocalTime, '_systime', _('Current Time'));
		o.cfgvalue = function() { return localtime };
		o.ntpd_support = ntpd_enabled;

		// o = s.taboption('time', form.Value, 'hostname', _('Hostname'));
		// o.datatype = 'hostname';

		/* could be used also as a default for LLDP, SNMP "system description" in the future */
		// o = s.taboption('time', form.Value, 'description', _('Description'), _('An optional, short description for this device'));
		// o.optional = true;

		// o = s.taboption('time', form.TextValue, 'notes', _('Notes'), _('Optional, free-form notes about this device'));
		// o.optional = true;

		// Timezone is not used
		// o = s.taboption('time', form.ListValue, 'zonename', _('Timezone'));
		// o.value('UTC');

		// var zones = Object.keys(timezones || {}).sort();
		// for (var i = 0; i < zones.length; i++)
		// 	o.value(zones[i]);

		// o.write = function(section_id, formvalue) {
		// 	var tz = timezones[formvalue] ? timezones[formvalue].tzstring : null;
		// 	uci.set('system', section_id, 'zonename', formvalue);
		// 	uci.set('system', section_id, 'timezone', tz);
		// };

		/*
		 * Logging
		 */

		o = s.taboption('logging', form.Value, 'log_size', _('System log buffer size'), "kiB")
		o.optional    = true
		o.placeholder = 16
		o.datatype    = 'uinteger'

/* Remove by LSS Do not use external log server
		o = s.taboption('logging', form.Value, 'log_ip', _('External system log server'))
		o.optional    = true
		o.placeholder = '0.0.0.0'
		o.datatype    = 'host'

		o = s.taboption('logging', form.Value, 'log_port', _('External system log server port'))
		o.optional    = true
		o.placeholder = 514
		o.datatype    = 'port'

		o = s.taboption('logging', form.ListValue, 'log_proto', _('External system log server protocol'))
		o.value('udp', 'UDP')
		o.value('tcp', 'TCP')
*/

		o = s.taboption('logging', form.Value, 'log_file', _('Write system log to file'))
		o.optional    = true
		o.placeholder = '/tmp/system.log'

		o = s.taboption('logging', form.ListValue, 'conloglevel', _('Log output level'))
		o.default = 4
		o.value(4, _('Error'))
		o.value(3, _('Critical'))
		o.value(2, _('Alert'))
		o.value(1, _('Emergency'))

		/*
		 * Zram Properties
		 */

		if (L.hasSystemFeature('zram')) {
			s.tab('zram', _('ZRam Settings'));

			o = s.taboption('zram', form.Value, 'zram_size_mb', _('ZRam Size'), _('Size of the ZRam device in megabytes'));
			o.optional    = true;
			o.placeholder = 16;
			o.datatype    = 'uinteger';

			o = s.taboption('zram', form.ListValue, 'zram_comp_algo', _('ZRam Compression Algorithm'));
			o.optional    = true;
			o.default     = 'lzo';
			o.value('lzo', 'lzo');
			o.value('lz4', 'lz4');
			o.value('zstd', 'zstd');
		}

		/*
		 * Language & Style
		 */

		// Language & Style is not used
		// o = s.taboption('language', form.ListValue, '_lang', _('Language'))
		// o.uciconfig = 'luci';
		// o.ucisection = 'main';
		// o.ucioption = 'lang';
		// o.value('auto');

		// var k = Object.keys(uci.get('luci', 'languages') || {}).sort();
		// for (var i = 0; i < k.length; i++)
		// 	if (k[i].charAt(0) != '.')
		// 		o.value(k[i], uci.get('luci', 'languages', k[i]));

		// o = s.taboption('language', form.ListValue, '_mediaurlbase', _('Design'))
		// o.uciconfig = 'luci';
		// o.ucisection = 'main';
		// o.ucioption = 'mediaurlbase';

		// var k = Object.keys(uci.get('luci', 'themes') || {}).sort();
		// for (var i = 0; i < k.length; i++)
		// 	if (k[i].charAt(0) != '.')
		// 		o.value(uci.get('luci', 'themes', k[i]), k[i]);

		/*
		 * NTP
		 */
		o = s.taboption('time', form.Flag, 'enabled', _('Enable NTP client'));
		o.rmempty = false;
		o.load = function(section_id) {
			var sections = uci.sections('chrony');
			var firstSection = sections.length > 0 ? sections[0]['.name'] : null;
			return firstSection ? uci.get('chrony', firstSection, 'enabled') : '0';
		};		
		o.write = function(section_id, value) {
			var sections = uci.sections('chrony');
			if (sections.length > 0) {
				var firstSection = sections[0]['.name'];
				uci.set('chrony', firstSection, 'enabled', value);
				console.log("write:", uci.get('chrony', firstSection, 'enabled'))
			}
		};

		o = s.taboption('time', form.DynamicList, 'pool', _('NTP server candidates'));
		o.datatype = 'host(0)';
		o.ucisection = 'chrony';
		o.depends('enabled', '1');
		o.load = function(section_id) {			
			var pools = uci.sections('chrony', 'pool'); // 'pool' 타입의 모든 섹션 가져오기.
			return pools.map(function(section) {
				return section.hostname; // 각 pool 섹션의 hostname 값만 가져옴.
			}).filter(Boolean); // 빈 값 제거.
		};
		o.write = function(section_id, value) {
			var existingPools = uci.sections('chrony', 'pool');

			// 기존 pool 섹션 삭제.
			existingPools.forEach(function(section) {
				uci.remove('chrony', section['.name']);
			});
		
			// 새로운 pool 섹션 추가.
			value.forEach(function(hostname) {
				var newSection = uci.add('chrony', 'pool');
				uci.set('chrony', newSection, 'hostname', hostname);
				uci.set('chrony', newSection, 'maxpoll', '12');
				uci.set('chrony', newSection, 'iburst', 'yes');
			});	
		};

		// Not use sysntpd. it is busybox ntp.
		// if (L.hasSystemFeature('sysntpd')) {
		// 	var default_servers = [
		// 		'0.openwrt.pool.ntp.org', '1.openwrt.pool.ntp.org',
		// 		'2.openwrt.pool.ntp.org', '3.openwrt.pool.ntp.org'
		// 	];

		// 	o = s.taboption('time', form.Flag, 'enabled', _('Enable NTP client'));
		// 	o.rmempty = false;
		// 	o.ucisection = 'ntp';
		// 	o.default = o.disabled;
		// 	o.write = function(section_id, value) {
		// 		ntpd_enabled = +value;

		// 		if (ntpd_enabled && !uci.get('system', 'ntp')) {
		// 			uci.add('system', 'timeserver', 'ntp');
		// 			uci.set('system', 'ntp', 'server', default_servers);
		// 		}

		// 		if (!ntpd_enabled)
		// 			uci.set('system', 'ntp', 'enabled', 0);
		// 		else
		// 			uci.unset('system', 'ntp', 'enabled');

		// 		return callInitAction('sysntpd', 'enable');
		// 	};
		// 	o.load = function(section_id) {
		// 		return (ntpd_enabled == 1 &&
		// 		        uci.get('system', 'ntp') != null &&
		// 		        uci.get('system', 'ntp', 'enabled') != 0) ? '1' : '0';
		// 	};

		// 	o = s.taboption('time', form.Flag, 'enable_server', _('Provide NTP server'));
		// 	o.ucisection = 'ntp';
		// 	o.depends('enabled', '1');

		// 	o = s.taboption('time', widgets.NetworkSelect, 'interface',
		// 		_('Bind NTP server'),
		// 		_('Provide the NTP server to the selected interface or, if unspecified, to all interfaces'));
		// 	o.ucisection = 'ntp';
		// 	o.depends('enable_server', '1');
		// 	o.multiple = false;
		// 	o.nocreate = true;
		// 	o.optional = true;

		// 	o = s.taboption('time', form.Flag, 'use_dhcp', _('Use DHCP advertised servers'));
		// 	o.ucisection = 'ntp';
		// 	o.default = o.enabled;
		// 	o.depends('enabled', '1');

		// 	o = s.taboption('time', form.DynamicList, 'server', _('NTP server candidates'));
		// 	o.datatype = 'host(0)';
		// 	o.ucisection = 'ntp';
		// 	o.depends('enabled', '1');
		// 	o.load = function(section_id) {
		// 		return uci.get('system', 'ntp', 'server');
		// 	};
		// }

		return m.render().then(function(mapEl) {
			poll.add(function() {
				return callGetLocaltime().then(function(t) {
					mapEl.querySelector('#localtime').value = formatTime(t);
				});
			});

			return mapEl;
		});
	},

	handleSaveApply: function(ev, mode) {
		return this.handleSave(ev).then(function() {			
			classes.ui.changes.apply(mode == '0'); // 이 시점에서 apply 진행.

			var sections = uci.sections('chrony');
			var action = 'stop'
			var value = '0'
			if (sections.length > 0) {
				var firstSection = sections[0]['.name'];
				value = uci.get('chrony', firstSection, 'enabled')

				if (value == '1') {
					action = 'restart'
				}
			}
			
			// console.log(String.format("handleSaveApply: %s %s", uci.get('chrony', firstSection, 'enabled'), action))
			// chronyd 서비스 재시작 또는 중지.
			return callInitAction('chronyd', action);
		});
	},
});
