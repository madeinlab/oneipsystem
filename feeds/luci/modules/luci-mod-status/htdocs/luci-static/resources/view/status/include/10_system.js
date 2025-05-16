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

function hexToString(hexStr) {
	if (!hexStr) return '';

	// hexStr: "31-32-33-34-35-36-37-38-39-30-00-00-00-00-00-00"
	const ascii = hexStr
		.replace(/-/g, ' ')
		.split(' ')
		.map(h => String.fromCharCode(parseInt(h, 16)))
		.join('')
		.replace(/\0/g, '') // null 문자 제거
		.trim();

	// ASCII printable check: 32~126
	const isPrintable = ascii.length > 0 && /^[\x20-\x7E]+$/.test(ascii);

	return isPrintable ? ascii : '';
}

function isMeaninglessHex(hexStr) {
	if (!hexStr) return true;
	const parts = hexStr.split('-');
	return parts.length > 1 && parts.every(p => p === parts[0]);
}

function isValidModel(model) {
	return model &&
		model.length > 0 &&
		model.length <= 32 &&
		/^[\x20-\x7E]+$/.test(model) &&
		!isMeaninglessHex(model);
}

return baseclass.extend({
	title: _('System'),

	load: function() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {}),
			fs.lines('/usr/lib/lua/luci/version.lua'),
			uci.load('system'),
			fs.exec('/sbin/mtk_factory_rw.sh', ['-r', 'model']).catch(function(err) {
				console.error('Failed to read model:', err);
				return { stdout: '' };
			}),
			fs.exec('/sbin/mtk_factory_rw.sh', ['-r', 'serial_no']).catch(function(err) {
				console.error('Failed to read serial:', err);
				return { stdout: '' };
			})
		]);
	},

	render: function(data) {
		var boardinfo   = data[0],
		    systeminfo  = data[1],
		    version_info = data[2],
		    model_hex = data[4] ? data[4].stdout.trim() : '',
		    serial_hex = data[5] ? data[5].stdout.trim() : '';

		var model_str = hexToString(model_hex);
		if (!isValidModel(model_str)) {
			model_str = 'OneIP System(default)';
		}
		var serial_str = hexToString(serial_hex);

		// Serial Number가 'DW'로 시작하고 11글자(숫자 9자리)인지 확인
		if (!/^DW\d{2}(0[1-9]|1[0-2])\d{5}$/.test(serial_str)) {
			serial_str = 'DW250599999';
		}

		var distversion = version_info.reverse().find(function(l) {
			return l.match(/^\s*distversion\s*=/);
		});
		distversion = distversion ? distversion.replace(/^\s*\w+\s*=\s*['"]([^'"]+)['"].*$/, '$1') : '';

		var datestr = null;

		if (systeminfo.localtime) {
			var date = new Date(systeminfo.localtime * 1000);

			datestr = '%04d-%02d-%02d %02d:%02d:%02d'.format(
				date.getFullYear(),
				date.getMonth() + 1,
				date.getDate(),
				date.getHours(),
				date.getMinutes(),
				date.getSeconds()
			);
		}

		var fields = [
			_('Model'),            model_str,
			_('Serial Number'),    serial_str,
			_('CPU'),              boardinfo.system,
			_('Firmware Version'), distversion,
			_('Kernel Version'),   boardinfo.kernel,
			_('Current Time'),     datestr,
			_('Uptime'),           systeminfo.uptime ? '%t'.format(systeminfo.uptime) : null
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
