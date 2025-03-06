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
'require tools.network as nettools';
'require validation';

var isReadonlyView = !L.hasViewPermission() || null

function isCIDR(value) {
	return Array.isArray(value) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/(\d{1,2}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.test(value);
}

function calculateBroadcast(s, use_cfgvalue) {
	var readfn = use_cfgvalue ? 'cfgvalue' : 'formvalue',
	    addropt = s.children.filter(function(o) { return o.option == 'ipaddr'})[0],
	    addrvals = addropt ? L.toArray(addropt[readfn](s.section)) : [],
	    maskopt = s.children.filter(function(o) { return o.option == 'netmask'})[0],
	    maskval = maskopt ? maskopt[readfn](s.section) : null,
	    firstsubnet = maskval ? addrvals[0] + '/' + maskval : addrvals.filter(function(a) { return a.indexOf('/') > 0 })[0];

	if (firstsubnet == null)
		return null;

	var addr_mask = firstsubnet.split('/'),
	    addr = validation.parseIPv4(addr_mask[0]),
	    mask = addr_mask[1];

	if (!isNaN(mask))
		mask = validation.parseIPv4(network.prefixToMask(+mask));
	else
		mask = validation.parseIPv4(mask);

	var bc = [
		addr[0] | (~mask[0] >>> 0 & 255),
		addr[1] | (~mask[1] >>> 0 & 255),
		addr[2] | (~mask[2] >>> 0 & 255),
		addr[3] | (~mask[3] >>> 0 & 255)
	];

	return bc.join('.');
}

function validateBroadcast(section_id, value) {
	var opt = this.map.lookupOption('broadcast', section_id),
	    node = opt ? this.map.findElement('id', opt[0].cbid(section_id)) : null,
	    addr = node ? calculateBroadcast(this.section, false) : null;

	if (node != null) {
		if (addr != null)
			node.querySelector('input').setAttribute('placeholder', addr);
		else
			node.querySelector('input').removeAttribute('placeholder');
	}

	return true;
}

return view.extend({
	CBIBroadcastValue: form.Value.extend({
		datatype: 'ip4addr("nomask")',

		render: function(option_index, section_id, in_table) {
			this.placeholder = calculateBroadcast(this.section, true);
			return form.Value.prototype.render.apply(this, [ option_index, section_id, in_table ]);
		}
	}),

    CBINetmaskValue: form.Value.extend({
		render: function(option_index, section_id, in_table) {
			var addropt = this.section.children.filter(function(o) { return o.option == 'ipaddr' })[0],
			    addrval = addropt ? addropt.cfgvalue(section_id) : null;

			if (addrval != null && isCIDR(addrval))
				return E([]);

			this.value('255.255.255.0');
			this.value('255.255.0.0');
			this.value('255.0.0.0');

			return form.Value.prototype.render.apply(this, [ option_index, section_id, in_table ]);
		},

		validate: validateBroadcast
	}),

    load: function() {
        return Promise.all([
            uci.load('network')
        ]);
    },

    render: function(data) {        
        var m, s, o

        m = new form.Map('network', _('IP Configuration'), _('Configure IP settings.(IPv4)'))

        s = m.section(form.NamedSection, 'wan')

        o = s.option(form.ListValue, 'protocol', _('Protocol'))
        o.value('static', _('Static IP'))
        o.value('dhcp', _('DHCP IP'))
        o.cfgvalue = function(section_id) {
            let proto = uci.get('network', section_id, 'proto')
            return proto === 'dhcp' ? 'dhcp' : 'static'
        }
        o.write = function(section_id, value) {
            if (value === 'dhcp') {
                uci.set('network', section_id, 'ipaddr', '');
                uci.set('network', section_id, 'netmask', '');
                uci.set('network', section_id, 'gateway', '');
                uci.set('network', section_id, 'broadcast', '');
                uci.set('network', section_id, 'dns', '')
            }
            return uci.set('network', section_id, 'proto', value)
        }

        o = s.option(form.Value, 'ipaddr', _('IP Address'))
        o.depends('protocol', 'static')
        o.datatype = 'ipaddr'
        o.rmempty = false
        o.onchange = function(section_id, ev) {
            // ipaddr 값이 입력될 때마다 broadcast를 업데이트
            const broadcastOpt = s.lookupOption('broadcast', section_id);
            if (broadcastOpt) {
                broadcastOpt[0].updateBroadcast(section_id)  // broadcast 업데이트
            }
        }

		o = s.option(this.CBINetmaskValue, 'netmask', _('Subnet Mask'))
        o.depends('protocol', 'static')
        o.datatype = 'ipaddr'
        o.rmempty = false

		o = s.option(form.Value, 'gateway', _('Gateway'))
        o.depends('protocol', 'static')
        o.datatype = 'ipaddr'
		o.rmempty = false

		o = s.option(this.CBIBroadcastValue, 'broadcast', _('Broadcast'))
        o.depends('protocol', 'static')
        o.datatype = 'ipaddr'

        o = s.option(form.DynamicList, 'dns', _('DNS Servers'))
        o.depends('protocol', 'static')
        o.datatype = 'ipaddr'
        o.rmempty = false;

        return m.render()
    }
})