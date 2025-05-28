'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/bin/sh'), null)
		]).then(function(stat) {
			var shellcmd = stat[0] ? stat[0].path : null;

			return fs.exec_direct(
				shellcmd,
				[
					'-c',
					[
						'/bin/dmesg',
						'| /bin/grep -E "^\[\s*([0-2]?[0-9])"',
						'| /bin/grep -E "Linux"'
					].join(' ')
				]
			).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
				return '';
			});
		});
	},

	render: function(logdata) {
		var loglines = logdata.trim().split(/\n/);

		return E([], [
			E('h2', {}, [ _('H/W Self Test Verification') ]),
			E('div', { 'id': 'content_syslog' }, [
				E('textarea', {
					'id': 'syslog',
					'style': 'font-size:12px',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': loglines.length + 1
				}, [ loglines.join('\n') ])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
