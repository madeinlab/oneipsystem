'use strict';
'require baseclass';
'require fs';
'require rpc';
'require uci';

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

return baseclass.extend({
	title: _('System'),

	load: function() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {}),
			fs.lines('/usr/lib/lua/luci/version.lua'),
			uci.load('system')
		]);
	},

	render: function(data) {
		var boardinfo   = data[0],
		    systeminfo  = data[1],
		    version_info = data[2];

		var distversion = version_info.reverse().find(function(l) {
			return l.match(/^\s*distversion\s*=/);
		});
		distversion = distversion ? distversion.replace(/^\s*\w+\s*=\s*['"]([^'"]+)['"].*$/, '$1') : '';

		var datestr = null;

		if (systeminfo.localtime) {
			var date = new Date(systeminfo.localtime * 1000);

			datestr = '%04d-%02d-%02d %02d:%02d:%02d'.format(
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

		var modelname = uci.get('system', '@system[0]', 'model') ? uci.get('system', '@system[0]', 'model') : boardinfo.model

		var fields = [
			//_('Model'),            boardinfo.model,
			_('Model'),            modelname,
			_('CPU'),              boardinfo.system,
			_('Firmware Version'), distversion,
			_('Kernel Version'),   boardinfo.kernel,
			_('Current Time'),     datestr,
			_('Uptime'),           systeminfo.uptime ? '%t'.format(systeminfo.uptime) : null
			// _('Load Average'),     Array.isArray(systeminfo.load) ? '%.2f, %.2f, %.2f'.format(
			// 	systeminfo.load[0] / 65535.0,
			// 	systeminfo.load[1] / 65535.0,
			// 	systeminfo.load[2] / 65535.0
			// ) : null
		];

		var table = E('table', { 'class': 'table' });

		for (var i = 0; i < fields.length; i += 2) {
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ fields[i] ]),
				E('td', { 'class': 'td left' }, [ (fields[i + 1] != null) ? fields[i + 1] : '?' ])
			]));
		}

		return table;
	}
});
