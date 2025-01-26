'use strict';
'require form';
'require view';
'require uci';
'require ui';

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('admin_manage')
        ]).then(() => {
            let sections = uci.sections('admin_manage', 'login_rule');
            if (!sections || sections.length === 0) {
                let sid = uci.add('admin_manage', 'login_rule');
                uci.set('admin_manage', sid, 'retry_count', '5');
                uci.set('admin_manage', sid, 'retry_interval', '5');
                return uci.save();
            }
        });
    },

    render: function() {
        var m = new form.Map('admin_manage', _('Login Configuration'),
            _('Configure login retry settings'));

        var s = m.section(form.TypedSection, 'login_rule');
        s.anonymous = true;
        s.addremove = false;

        var o;
        o = s.option(form.Value, 'retry_count', _('Number of retries'));
        o.datatype = 'uinteger';
        o.default = '5';
        o.rmempty = false;
        o.write = function(section_id, formvalue) {
            return uci.set('admin_manage', section_id, 'retry_count', formvalue);
        };

        o = s.option(form.Value, 'retry_interval', _('Interval retries(minutes)'));
        o.datatype = 'uinteger';
        o.default = '5';
        o.rmempty = false;
        o.write = function(section_id, formvalue) {
            return uci.set('admin_manage', section_id, 'retry_interval', formvalue);
        };

        return m.render();
    }
});
