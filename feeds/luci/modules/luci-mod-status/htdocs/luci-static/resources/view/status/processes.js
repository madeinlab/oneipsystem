'use strict';
'require view';
'require fs';
'require ui';
'require rpc';

var callLuciProcessList = rpc.declare({
	object: 'luci',
	method: 'getProcessList',
	expect: { result: [] }
});

return view.extend({
	load: function() {
		return callLuciProcessList();
	},

	handleSignal: function(signum, pid, ev) {
		return fs.exec('/bin/kill', ['-%d'.format(signum), '%s'.format(pid)]).then(L.bind(function() {
			return callLuciProcessList().then(L.bind(function(processes) {
				this.updateTable('.table', processes);
			}, this));
		}, this)).catch(function(e) { ui.addNotification(null, E('p', e.message)) });
	},

	updateTable: function(table, processes) {
		var rows = [];

		processes.sort(function(a, b) {
			return (a.PID - b.PID);
		});

		for (var i = 0; i < processes.length; i++) {
			var proc = processes[i];
			
			// 커널 스레드 필터링 (대괄호로 감싸진 프로세스 제외)
			if (proc.COMMAND.match(/^\[.*\]$/))
				continue;

			rows.push([
				proc.PID,
				proc.USER,
				proc['%CPU'],
				proc['%MEM'],
				proc.STAT,
				proc.TIME || '0:00',
				proc.CMDLINE || proc.COMMAND
			]);
		}

		cbi_update_table(table, rows, E('em', _('No information available')));
	},

	render: function(processes) {
		var v = E([], [
			E('h2', _('Processes')),
			E('div', { 'class': 'cbi-map-descr' }, _('This list gives an overview over currently running system processes and their status.')),

			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('PID')),
					E('th', { 'class': 'th' }, _('USER')),
					E('th', { 'class': 'th' }, _('%CPU')),
					E('th', { 'class': 'th' }, _('%MEM')),
					E('th', { 'class': 'th' }, _('STAT')),
					E('th', { 'class': 'th' }, _('TIME')),
					E('th', { 'class': 'th' }, _('COMMAND'))
				])
			])
		]);

		this.updateTable(v.lastElementChild, processes);

		return v;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
