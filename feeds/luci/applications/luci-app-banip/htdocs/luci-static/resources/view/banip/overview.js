'use strict';
'require view';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require tools.widgets as widgets';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['list']), {}),
			L.resolveDefault(fs.exec_direct('/usr/sbin/iptables', [ '-L', '-n', '-v' ]), null),
			L.resolveDefault(fs.exec_direct('/usr/sbin/ip6tables', [ '-L', '-n', '-v' ]), null),
			L.resolveDefault(fs.read_direct('/etc/banip/banip.countries'), ''),
			uci.load('banip')
		]);
	},

	render: function() {
		var m, s, o;

		m = new form.Map('banip', _('IP Filtering'));

		s = m.section(form.NamedSection, 'global', 'banip');
		s.addremove = false;

		o = s.option(form.Flag, 'ban_enabled', _('Enabled'));
		o.rmempty = false;

		o = s.option(form.Flag, 'ban_whitelistonly', _('Whitelist Only'));
		o.rmempty = true;

		return m.render();
	},

	handleReset: null,
});
