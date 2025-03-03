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
			L.resolveDefault(fs.exec_direct('/usr/sbin/iptables', ['-L']), null),
			L.resolveDefault(fs.exec_direct('/usr/sbin/ip6tables', ['-L']), null),
			L.resolveDefault(fs.read_direct('/etc/banip/banip.countries'), ''),
			L.resolveDefault(fs.read_direct('/etc/banip/banip.whitelist'), ''),
			L.resolveDefault(fs.read_direct('/etc/banip/banip.blacklist'), ''),
			uci.load('banip')
		]);
	},

	render: function(result) {

		var whitelist = result[4];
		var blacklist = result[5];

		var m, s, o;

		m = new form.Map('banip', _('IP Filtering'));

		/*
			tabbed config section
		*/
		s = m.section(form.NamedSection, 'global', 'banip');
		s.addremove = false;

		/*
			general settings tab
		*/
		o = s.option(form.Flag, 'ban_enabled', _('Enabled'));
		o.rmempty = false;

		o = s.option(form.Flag, 'ban_whitelistonly', _('Whitelist Only'));
		o.rmempty = true;

		// Whitelist
		o = s.option(form.TextValue, 'ban_white', _('Whitelist'), 
			_('This is the local banIP whitelist to always allow certain IP/CIDR addresses.<br /> \
			<em><b>Please note:</b></em> add only one IPv4 address, IPv6 address or domain name per line. Comments introduced with \'#\' are allowed - wildcards and regex are not.')),
		o.rows = 10; // Textarea 높이
		o.wrap = 'off'; // 줄바꿈 설정
		o.cfgvalue = function(section_id) {
			return whitelist != null ? whitelist : ''
		};
		o.write = async function(section_id, formvalue) {
			try {
				var value =  formvalue.trim().replace(/\r\n/g, '\n')
				await new Promise((resolve, reject) => {
					this.map.data.set(
						this.uciconfig || this.section.uciconfig || this.map.config,
						this.ucisection || section_id,
						this.ucioption || this.option,
						value
					);
					resolve();
				});
				fs.write('/etc/banip/banip.whitelist', value.trim().replace(/\r\n/g, '\n') + '\n');
				const updatedValue = fs.read_direct('/etc/banip/banip.whitelist');
				whitelist = updatedValue;
			} catch (e) {
				console.error('Error in write function:', e);
				return await Promise.reject(e);
			}
		};
		o.placeholder = '192.168.1.100\n#192.168.1.101 목록에서 제외';

		// Blacklist
		o = s.option(form.TextValue, 'ban_black', _('Blacklist'), 
			_('This is the local banIP blacklist to always-deny certain IP/CIDR addresses.<br /> \
			<em><b>Please note:</b></em> add only one IPv4 address, IPv6 address or domain name per line. Comments introduced with \'#\' are allowed - wildcards and regex are not.'));
		o.rows = 10; // Textarea 높이
		o.wrap = 'off'; // 줄바꿈 설정
		o.cfgvalue = function(section_id) {
			return blacklist != null ? blacklist : ''
		};
		o.write = async function(section_id, formvalue) {
			try {
				var value =  formvalue.trim().replace(/\r\n/g, '\n')
				await new Promise((resolve, reject) => {
					this.map.data.set(
						this.uciconfig || this.section.uciconfig || this.map.config,
						this.ucisection || section_id,
						this.ucioption || this.option,
						value
					);
					resolve();
				});
				fs.write('/etc/banip/banip.blacklist', value + '\n');
				const updatedValue = fs.read_direct('/etc/banip/banip.blacklist');
				blacklist = updatedValue;
			} catch (e) {
				console.error('Error in write function:', e);
				return await Promise.reject(e);
			}
		};
		o.placeholder = '192.168.1.100\n#192.168.1.101 목록에서 제외';

		return m.render();
	},
	handleReset: null,
	handleSaveApply: function(ev, mode) {
		return this.handleSave(ev).then(function() {
			classes.ui.changes.apply(mode == '0');
			fs.exec_direct('/etc/init.d/banip', ['restart'])
		});
	},	
});
