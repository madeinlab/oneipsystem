'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require form';
'require firewall as fwmodel';
'require tools.firewall as fwtool';
'require tools.widgets as widgets';

function rule_proto_txt(s, ctHelpers) {
	var f = (uci.get('firewall', s, 'family') || '').toLowerCase().replace(/^(?:any|\*)$/, '');

	var proto = L.toArray(uci.get('firewall', s, 'proto')).filter(function(p) {
		return (p != '*' && p != 'any' && p != 'all');
	}).map(function(p) {
		var pr = fwtool.lookupProto(p);
		return {
			num:   pr[0],
			name:  pr[1],
			types: (pr[0] == 1 || pr[0] == 58) ? L.toArray(uci.get('firewall', s, 'icmp_type')) : null
		};
	});

	m = String(uci.get('firewall', s, 'helper') || '').match(/^(!\s*)?(\S+)$/);
	var h = m ? {
		val:  m[0].toUpperCase(),
		inv:  m[1],
		name: (ctHelpers.filter(function(ctH) { return ctH.name.toLowerCase() == m[2].toLowerCase() })[0] || {}).description
	} : null;

	m = String(uci.get('firewall', s, 'mark')).match(/^(!\s*)?(0x[0-9a-f]{1,8}|[0-9]{1,10})(?:\/(0x[0-9a-f]{1,8}|[0-9]{1,10}))?$/i);
	var w = m ? {
		val:  m[0].toUpperCase().replace(/X/g, 'x'),
		inv:  m[1],
		num:  '0x%02X'.format(+m[2]),
		mask: m[3] ? '0x%02X'.format(+m[3]) : null
	} : null;

	m = String(uci.get('firewall', s, 'dscp')).match(/^(!\s*)?(?:(CS[0-7]|BE|AF[1234][123]|EF)|(0x[0-9a-f]{1,2}|[0-9]{1,2}))$/);
	var d = m ? {
		val:  m[0],
		inv:  m[1],
		name: m[2],
		num:  m[3] ? '0x%02X'.format(+m[3]) : null
	} : null;

	return fwtool.fmt(_('%{src?%{dest?Forwarded:Incoming}:Outgoing} %{ipv6?%{ipv4?<var>IPv4</var> and <var>IPv6</var>:<var>IPv6</var>}:<var>IPv4</var>}%{proto?, protocol %{proto#%{next?, }%{item.types?<var class="cbi-tooltip-container">%{item.name}<span class="cbi-tooltip">ICMP with types %{item.types#%{next?, }<var>%{item}</var>}</span></var>:<var>%{item.name}</var>}}}%{mark?, mark <var%{mark.inv? data-tooltip="Match fwmarks except %{mark.num}%{mark.mask? with mask %{mark.mask}}.":%{mark.mask? data-tooltip="Mask fwmark value with %{mark.mask} before compare."}}>%{mark.val}</var>}%{dscp?, DSCP %{dscp.inv?<var data-tooltip="Match DSCP classifications except %{dscp.num?:%{dscp.name}}">%{dscp.val}</var>:<var>%{dscp.val}</var>}}%{helper?, helper %{helper.inv?<var data-tooltip="Match any helper except &quot;%{helper.name}&quot;">%{helper.val}</var>:<var data-tooltip="%{helper.name}">%{helper.val}</var>}}'), {
		ipv4: (!f || f == 'ipv4'),
		ipv6: (!f || f == 'ipv6'),
		src:  uci.get('firewall', s, 'src'),
		dest: uci.get('firewall', s, 'dest'),
		proto: proto,
		helper: h,
		mark:   w,
		dscp:   d
	});
}

function rule_src_txt(s, hosts) {
	var z = uci.get('firewall', s, 'src'),
	    d = (uci.get('firewall', s, 'direction') == 'in') ? uci.get('firewall', s, 'device') : null;

	return fwtool.fmt(_('From %{src}%{src_device?, interface <var>%{src_device}</var>}%{src_ip?, IP %{src_ip#%{next?, }<var%{item.inv? data-tooltip="Match IP addresses except %{item.val}."}>%{item.ival}</var>}}%{src_port?, port %{src_port#%{next?, }<var%{item.inv? data-tooltip="Match ports except %{item.val}."}>%{item.ival}</var>}}%{src_mac?, MAC %{src_mac#%{next?, }<var%{item.inv? data-tooltip="Match MACs except %{item.val}%{item.hint.name? a.k.a. %{item.hint.name}}.":%{item.hint.name? data-tooltip="%{item.hint.name}"}}>%{item.ival}</var>}}'), {
		src: E('span', { 'class': 'zonebadge', 'style': fwmodel.getZoneColorStyle(z) }, [(z == '*') ? E('em', _('any zone')) : (z ? E('strong', z) : E('em', _('this device')))]),
		src_ip: fwtool.map_invert(uci.get('firewall', s, 'src_ip'), 'toLowerCase'),
		src_mac: fwtool.map_invert(uci.get('firewall', s, 'src_mac'), 'toUpperCase').map(function(v) { return Object.assign(v, { hint: hosts[v.val] }) }),
		src_port: fwtool.map_invert(uci.get('firewall', s, 'src_port')),
		src_device: d
	});
}

function rule_dest_txt(s) {
	var z = uci.get('firewall', s, 'dest'),
	    d = (uci.get('firewall', s, 'direction') == 'out') ? uci.get('firewall', s, 'device') : null;

	return fwtool.fmt(_('To %{dest}%{dest_device?, interface <var>%{dest_device}</var>}%{dest_ip?, IP %{dest_ip#%{next?, }<var%{item.inv? data-tooltip="Match IP addresses except %{item.val}."}>%{item.ival}</var>}}%{dest_port?, port %{dest_port#%{next?, }<var%{item.inv? data-tooltip="Match ports except %{item.val}."}>%{item.ival}</var>}}'), {
		dest: E('span', { 'class': 'zonebadge', 'style': fwmodel.getZoneColorStyle(z) }, [(z == '*') ? E('em', _('any zone')) : (z ? E('strong', z) : E('em', _('this device')))]),
		dest_ip: fwtool.map_invert(uci.get('firewall', s, 'dest_ip'), 'toLowerCase'),
		dest_port: fwtool.map_invert(uci.get('firewall', s, 'dest_port')),
		dest_device: d
	});
}

function rule_limit_txt(s) {
	var m = String(uci.get('firewall', s, 'limit')).match(/^(\d+)\/([smhd])\w*$/i),
	    l = m ? {
			num:   +m[1],
			unit:  ({ s: _('second'), m: _('minute'), h: _('hour'), d: _('day') })[m[2]],
			burst: uci.get('firewall', s, 'limit_burst')
		} : null;

	if (!l)
		return '';

	return fwtool.fmt(_('Limit matching to <var>%{limit.num}</var> packets per <var>%{limit.unit}</var>%{limit.burst? burst <var>%{limit.burst}</var>}'), { limit: l });
}

function rule_target_txt(s, ctHelpers) {
	var t = uci.get('firewall', s, 'target'),
	    h = (uci.get('firewall', s, 'set_helper') || '').toUpperCase(),
	    s = {
	    	target: t,
	    	src:    uci.get('firewall', s, 'src'),
	    	dest:   uci.get('firewall', s, 'dest'),
	    	set_helper: h,
	    	set_mark:   uci.get('firewall', s, 'set_mark'),
	    	set_xmark:  uci.get('firewall', s, 'set_xmark'),
	    	set_dscp:   uci.get('firewall', s, 'set_dscp'),
	    	helper_name: (ctHelpers.filter(function(ctH) { return ctH.name.toUpperCase() == h })[0] || {}).description
	    };

	switch (t) {
	case 'DROP':
		return fwtool.fmt(_('<var data-tooltip="DROP">Drop</var> %{src?%{dest?forward:input}:output}'), s);

	case 'ACCEPT':
		return fwtool.fmt(_('<var data-tooltip="ACCEPT">Accept</var> %{src?%{dest?forward:input}:output}'), s);

	case 'REJECT':
		return fwtool.fmt(_('<var data-tooltip="REJECT">Reject</var> %{src?%{dest?forward:input}:output}'), s);

	// case 'NOTRACK':
	// 	return fwtool.fmt(_('<var data-tooltip="NOTRACK">Do not track</var> %{src?%{dest?forward:input}:output}'), s);

	// case 'HELPER':
	// 	return fwtool.fmt(_('<var data-tooltip="HELPER">Assign conntrack</var> helper <var%{helper_name? data-tooltip="%{helper_name}"}>%{set_helper}</var>'), s);

	// case 'MARK':
	// 	return fwtool.fmt(_('<var data-tooltip="MARK">%{set_mark?Assign:XOR}</var> firewall mark <var>%{set_mark?:%{set_xmark}}</var>'), s);

	// case 'DSCP':
	// 	return fwtool.fmt(_('<var data-tooltip="DSCP">Assign DSCP</var> classification <var>%{set_dscp}</var>'), s);

	default:
		return t;
	}
}

return view.extend({
	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),

	callConntrackHelpers: rpc.declare({
		object: 'luci',
		method: 'getConntrackHelpers',
		expect: { result: [] }
	}),

	load: function() {
		return Promise.all([
			this.callHostHints(),
			this.callConntrackHelpers(),
			uci.load('firewall')
		]);
	},

	render: function(data) {
		if (fwtool.checkLegacySNAT())
			return fwtool.renderMigration();
		else
			return this.renderRules(data);
	},

	renderRules: function(data) {
		var hosts = data[0],
		    ctHelpers = data[1],
		    m, s, o;

		m = new form.Map('firewall', _('Administrator IP'),
			_('Administrator IP rules define policies for controlling access from specific IP addresses. For example, you can allow or deny only specific IP addresses to access the router management page.'));

		s = m.section(form.GridSection, 'rule');
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = false;

		s.renderRowActions = function(section_id) {
			var name = uci.get('firewall', section_id, 'name') || '';
			if (name === 'Admin_IP_Default_Policy')
				return E('td'); // 빈 셀 반환
			return E('td', { 'class': 'cbi-section-table-cell cbi-section-actions' }, [
				E('button', {
					'class': 'btn cbi-button-remove',
					'click': ui.createHandlerFn(this, 'handleRemove', section_id)
				}, _('삭제'))
			]);
		};

		s.tab('general', _('General Settings'));

		s.filter = function(section_id) {
			var target = uci.get('firewall', section_id, 'target');
			var name = uci.get('firewall', section_id, 'name') || '';
			return (target !== 'SNAT') && (name.startsWith('Admin_IP') || name === 'Default Policy');
		};

		s.sectiontitle = function(section_id) {
			return uci.get('firewall', section_id, 'name') || _('Unnamed rule');
		};

		s.handleAdd = function(ev) {
			var config_name = this.uciconfig || this.map.config;
			var found = null;
			var used = new Set();

			uci.sections('firewall', 'rule').forEach(function(rule) {
				var name = uci.get('firewall', rule['.name'], 'name');
				if (name && name.startsWith('NoAdmin_IP_') && uci.get('firewall', rule['.name'], 'enabled') === '0' && !found) {
					found = rule['.name'];
				}
				if (name && name.startsWith('Admin_IP_')) {
					var idx = parseInt(name.replace('Admin_IP_', ''), 10);
					used.add(idx);
				}
			});

			if (!found) {
				ui.showModal(_('Error'), E('p', _('No available Admin_IP slots.')));
				return;
			}

			// 다음 사용 가능한 인덱스 찾기
			var next_idx = -1;
			for (var i = 0; i <= 9; i++) {
				if (!used.has(i)) {
					next_idx = i;
					break;
				}
			}
			if (next_idx === -1) {
				ui.showModal(_('Error'), E('p', _('All Admin_IP rule slots (0-9) are currently in use.')));
				return;
			}

			// 이름 및 옵션 변경
			uci.set('firewall', found, 'name', 'Admin_IP_' + next_idx);
			uci.set('firewall', found, 'enabled', '1');
			uci.set('firewall', found, 'src', 'wan');
			uci.set('firewall', found, 'proto', 'all');
			uci.set('firewall', found, 'target', 'ACCEPT');
			// src_ip 등은 모달에서 입력받음
			this.addedSection = found;
			this.renderMoreOptionsModal(found);
		};

		s.handleRemove = function(section_id) {
			var name = uci.get('firewall', section_id, 'name');
			if (name && name.startsWith('Admin_IP_')) {
				var idx = name.replace('Admin_IP_', '');
				uci.set('firewall', section_id, 'name', 'NoAdmin_IP_' + idx);
				uci.set('firewall', section_id, 'enabled', '0');
				uci.set('firewall', section_id, 'src', 'wan');
				uci.set('firewall', section_id, 'proto', 'all');
				uci.set('firewall', section_id, 'target', 'ACCEPT');
				this.map.save();
			}
		};

		o = s.taboption('general', form.Value, 'name', _('Name'));
		o.placeholder = _('Unnamed rule');
		o.modalonly = true;
		o.readonly = function(section_id) {
			var current_name = uci.get('firewall', section_id, 'name');
			if (current_name && /^Admin_IP_\d+$/.test(current_name)) {
				var num_str = current_name.substring('Admin_IP_'.length);
				var num = parseInt(num_str, 10);
				if (num >= 0 && num <= 9) {
					return true; // Make it read-only
				}
			}
			return false; // Otherwise, editable
		};

		// o = s.option(form.DummyValue, '_match', _('Match'));
		// o.modalonly = false;
		// o.textvalue = function(s) {
		// 	return E('small', [
		// 		rule_proto_txt(s, ctHelpers), E('br'),
		// 		rule_src_txt(s, hosts), E('br'),
		// 		rule_dest_txt(s), E('br'),
		// 		rule_limit_txt(s)
		// 	]);
		// };
		o = s.option(form.DummyValue, '_ip', _('Target source address'));
		o.modalonly = false;		
		o.textvalue = function(s) {
			const src_ips = fwtool.map_invert(uci.get('firewall', s, 'src_ip'), 'toLowerCase');
			return E('small', src_ips.map(function(ip) {
				let val = ip.ival == "0.0.0.0/0" ? _('Any external IP') : ip.ival
				return E('div', val);
			}));
		};

		o = s.option(form.ListValue, '_target', _('Action'));
		o.modalonly = false;
		o.textvalue = function(s) {
			return rule_target_txt(s, ctHelpers);
		};

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.modalonly = false;
		o.default = o.enabled;
		o.editable = true;
		o.renderWidget = function(section_id, option_index, cfgvalue) {
			var widget = form.Flag.prototype.renderWidget.apply(this, arguments);
			var name = uci.get('firewall', section_id, 'name');
			if (name === 'Admin_IP_Default_Policy') {
				var checkbox = widget.querySelector ? widget.querySelector('input[type=checkbox]') : widget;
				if (checkbox) {
					checkbox.addEventListener('change', function(ev) {
						if (checkbox.checked) {
							var has_admin_ip = false;
							uci.sections('firewall', 'rule').forEach(function(rule) {
								var n = uci.get('firewall', rule['.name'], 'name');
								var en = uci.get('firewall', rule['.name'], 'enabled');
								if (n && n.match(/^Admin_IP_\d+$/) && en === '1') {
									has_admin_ip = true;
								}
							});
							if (!has_admin_ip) {
								ui.showModal(_('Warning'), [
									E('h2', { style: 'color:red;font-size:1.2em;text-align:center;' }, _('Please register at least one available Admin IP before enabling the default policy for Admin IP.')),
									E('p', { style: 'font-size:1.2em;text-align:center;' }, _('If you enable the default policy without any Admin IP registered, you may lose web access!')),
									E('p', { style: 'font-size:1.1em;text-align:center;color:#555;' }, _('(If communication is lost for more than 90 seconds, the change will be automatically rolled back.)')),
									E('div', { 'class': 'right' }, [
										E('button', { 'class': 'btn', 'click': ui.hideModal }, _('OK'))
									])
								]);
							}
						}
					});
				}
			}
			return widget;
		};

		o.tooltip = function(section_id) {
			var weekdays = uci.get('firewall', section_id, 'weekdays');
			var monthdays = uci.get('firewall', section_id, 'monthdays');
			var start_time = uci.get('firewall', section_id, 'start_time');
			var stop_time = uci.get('firewall', section_id, 'stop_time');
			var start_date = uci.get('firewall', section_id, 'start_date');
			var stop_date = uci.get('firewall', section_id, 'stop_date');

			if (weekdays || monthdays || start_time || stop_time || start_date || stop_date )
				return _('Time restrictions are enabled for this rule');

			return null;
		};

		fwtool.addIPOption(s, 'general', 'src_ip', _('Target source address'), null, '', hosts, true);
		var src_ip_field = s.children.filter(function(o) { return o.option == 'src_ip' })[0];
		if (src_ip_field) {
			src_ip_field.renderWidget = function(section_id, option_index, cfgvalue) {
				var widget = this.super('renderWidget', [section_id, option_index, cfgvalue]);
				if (widget) {
					widget.setAttribute('style', 'border-color: var(--main-bright-color)');
				}
				return widget;
			};
			// 저장 시 option src_ip로, CIDR /32로 저장
			src_ip_field.write = function(section_id, value) {
				if (Array.isArray(value)) value = value[0];
				if (value && !value.includes('/')) value += '/32';
				uci.set('firewall', section_id, 'src_ip', value);

				// 디폴트 설정값
				var current_name = uci.get('firewall', section_id, 'name');
				if (current_name && /^Admin_IP_\d+$/.test(current_name)) {
					uci.set('firewall', section_id, 'proto', 'all');
					uci.set('firewall', section_id, 'src', 'wan');
					uci.set('firewall', section_id, 'dest', '');
					uci.set('firewall', section_id, 'dest_ip', '');
				}

				return true;
			};			
		}

		o = s.taboption('general', form.Value, 'src_port', _('Source port'));
		o.modalonly = true;
		o.datatype = 'list(neg(portrange))';
		o.placeholder = _('any');
		o.depends({ proto: 'tcp', '!contains': true });
		o.depends({ proto: 'udp', '!contains': true });

		o = s.taboption('general', form.ListValue, 'target', _('Action'));
		o.modalonly = true;
		o.default = 'ACCEPT';
		o.value('DROP', _('drop'));
		o.value('ACCEPT', _('accept'));
		o.value('REJECT', _('reject'));
		o.renderWidget = function(section_id, option_index, cfgvalue) {
			var widget = this.super('renderWidget', [section_id, option_index, cfgvalue]);
			if (widget) {
				widget.setAttribute('style', 'border-color: var(--main-bright-color)');
			}
			return widget;
		};

		// o = s.taboption('general', fwtool.CBIProtocolSelect, 'proto', _('Protocol'));
		// o.modalonly = true;
		// o.cfgvalue = function(section_id) {
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	if (current_name && /^Admin_IP_\d+$/.test(current_name)) {
		// 		return 'all'; // Use 'all' for 'Any' for Admin_IP rules
		// 	}
		// 	return uci.get('firewall', section_id, 'proto') || 'tcp udp'; // Raw value for other rules, default to 'tcp udp'
		// };
		// o.write = function(section_id, value) {
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	if (current_name && /^Admin_IP_\d+$/.test(current_name)) {
		// 		return uci.set('firewall', section_id, 'proto', 'all'); // Save as 'all'
		// 	}
		// 	return this.super('write', [section_id, value]); // Default behavior for other rules
		// };
		// o.readonly = function(section_id) { // Make readonly for Admin_IP_X rules
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	return (current_name && /^Admin_IP_\d+$/.test(current_name));
		// };
		// o.default = 'tcp udp'; // Default for general rules if not Admin_IP_X

		// o = s.taboption('general', widgets.ZoneSelect, 'src', _('Source zone'));
		// o.modalonly = true;
		// o.nocreate = true;
		// o.allowany = true;
		// o.allowlocal = 'src';
		// o.cfgvalue = function(section_id) {
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	if (current_name && /^Admin_IP_\d+$/.test(current_name)) {
		// 		return 'wan'; // For Admin_IP rules, source zone is always 'wan'
		// 	}
		// 	return this.super('cfgvalue', [section_id]); // Default behavior for other rules
		// };
		// o.write = function(section_id, value) {
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	if (current_name && /^Admin_IP_\d+$/.test(current_name)) {
		// 		return uci.set('firewall', section_id, 'src', 'wan'); // Ensure it's saved as 'wan'
		// 	}
		// 	return this.super('write', [section_id, value]);
		// };
		// o.readonly = function(section_id) { // Make readonly for Admin_IP_X rules
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	return (current_name && /^Admin_IP_\d+$/.test(current_name));
		// };

		// // 출발지 주소 필드
		// fwtool.addIPOption(s, 'general', 'src_ip', _('Source address'), null, '', hosts, true);
		// var src_ip_field = s.children.filter(function(o) { return o.option == 'src_ip' })[0];
		// if (src_ip_field) {
		// 	src_ip_field.renderWidget = function(section_id, option_index, cfgvalue) {
		// 		var widget = this.super('renderWidget', [section_id, option_index, cfgvalue]);
		// 		if (widget) {
		// 			widget.setAttribute('style', 'border-color: var(--main-bright-color)');
		// 		}
		// 		return widget;
		// 	};
		// 	// 저장 시 option src_ip로, CIDR /32로 저장
		// 	src_ip_field.write = function(section_id, value) {
		// 		if (Array.isArray(value)) value = value[0];
		// 		if (value && !value.includes('/')) value = value + '/32';
		// 		return uci.set('firewall', section_id, 'src_ip', value);
		// 	};
		// }

		// o = s.taboption('general', form.Value, 'src_port', _('Source port'));
		// o.modalonly = true;
		// o.datatype = 'list(neg(portrange))';
		// o.placeholder = _('any');
		// o.depends({ proto: 'tcp', '!contains': true });
		// o.depends({ proto: 'udp', '!contains': true });

		// o = s.taboption('general', widgets.ZoneSelect, 'dest', _('Destination zone'));
		// o.modalonly = true;
		// o.nocreate = true;
		// o.allowany = true;
		// o.allowlocal = true;
		// o.cfgvalue = function(section_id) {
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	if (current_name && /^Admin_IP_\d+$/.test(current_name)) {
		// 		return ''; // Device(input)를 의미
		// 	}
		// 	return this.super('cfgvalue', [section_id]);
		// };
		// o.write = function(section_id, value) {
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	if (current_name && /^Admin_IP_\d+$/.test(current_name)) {
		// 		return uci.set('firewall', section_id, 'dest', '');
		// 	}
		// 	return this.super('write', [section_id, value]);
		// };
		// o.readonly = function(section_id) {
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	return (current_name && /^Admin_IP_\d+$/.test(current_name));
		// };

		// // 목적지 주소 필드
		// o = s.taboption('general', form.Value, 'dest_ip', _('Destination address'));
		// o.modalonly = true;
		// o.cfgvalue = function(section_id) {
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	if (current_name && /^Admin_IP_\d+$/.test(current_name)) {
		// 		return '-';
		// 	}
		// 	return this.super('cfgvalue', [section_id]);
		// };
		// o.write = function(section_id, value) {
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	if (current_name && /^Admin_IP_\d+$/.test(current_name)) {
		// 		return uci.set('firewall', section_id, 'dest_ip', '');
		// 	}
		// 	return this.super('write', [section_id, value]);
		// };
		// o.readonly = function(section_id) {
		// 	var current_name = uci.get('firewall', section_id, 'name');
		// 	return (current_name && /^Admin_IP_\d+$/.test(current_name));
		// };

		// o = s.taboption('general', form.Value, 'dest_port', _('Destination port'));
		// o.modalonly = true;
		// o.datatype = 'list(neg(portrange))';
		// o.placeholder = _('any');
		// o.depends({ proto: 'tcp', '!contains': true });
		// o.depends({ proto: 'udp', '!contains': true });

		// o = s.taboption('general', form.ListValue, 'target', _('Action'));
		// o.modalonly = true;
		// o.default = 'ACCEPT';
		// o.value('DROP', _('drop'));
		// o.value('ACCEPT', _('accept'));
		// o.value('REJECT', _('reject'));
		// // o.value('NOTRACK', _("don't track"));
		// // o.value('HELPER', _('assign conntrack helper'));
		// // o.value('MARK_SET', _('apply firewall mark'));
		// // o.value('MARK_XOR', _('XOR firewall mark'));
		// // o.value('DSCP', _('DSCP classification'));
		// o.renderWidget = function(section_id, option_index, cfgvalue) {
		// 	var widget = this.super('renderWidget', [section_id, option_index, cfgvalue]);
		// 	if (widget) {
		// 		widget.setAttribute('style', 'border-color: var(--main-bright-color)');
		// 	}
		// 	return widget;
		// };

		// fwtool.addMarkOption(s, 1);
		// fwtool.addMarkOption(s, 2);
		// fwtool.addDSCPOption(s, true);

		// o = s.taboption('general', form.ListValue, 'set_helper', _('Tracking helper'), _('Assign the specified connection tracking helper to matched traffic.'));
		// o.modalonly = true;
		// o.placeholder = _('any');
		// o.depends('target', 'HELPER');
		// for (var i = 0; i < ctHelpers.length; i++)
		// 	o.value(ctHelpers[i].name, '%s (%s)'.format(ctHelpers[i].description, ctHelpers[i].name.toUpperCase()));

		return m.render();
	}
});
