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
            let sections = uci.sections('admin_manage', 'password_rule');
            if (!sections || sections.length === 0) {
                let sid = uci.add('admin_manage', 'password_rule');
                uci.set('admin_manage', sid, 'min_length', '9');
                uci.set('admin_manage', sid, 'max_length', '32');
                return uci.save();
            }
        });
    },

    render: function() {
        var m = new form.Map('admin_manage', _('Password Rules'),
            _('Configure password length requirements'));

        var s = m.section(form.TypedSection, 'password_rule');
        s.anonymous = true;
        s.addremove = false;

        var o;
        o = s.option(form.Value, 'min_length', _('Minimum Length'));
        o.datatype = 'uinteger';
        o.default = '9';
        o.rmempty = false;
        o.write = function(section_id, formvalue) {
            return uci.set('admin_manage', section_id, 'min_length', formvalue);
        };

        o = s.option(form.Value, 'max_length', _('Maximum Length'));
        o.datatype = 'uinteger';
        o.default = '32';
        o.rmempty = false;
        o.write = function(section_id, formvalue) {
            return uci.set('admin_manage', section_id, 'max_length', formvalue);
        };

        o = s.option(form.Flag, 'check_sequential', _('Check sequential characters'),
            _('Prohibits three or more consecutive or identical characters. (e.g., 123, 111, abc, aaa)'));
        o.rmempty = false;
        o.default = o.disabled; // Disable

        o = s.option(form.Flag, 'check_sequential_ignore_case', _('Ignore case'),
            _('Case insensitive. (e.g., abc, Abc)'));
        o.depends('check_sequential', '1');
        o.default = o.disabled; // Disable

        o = s.option(form.Flag, 'check_sequential_special', _('Check special charaters'),
            _('Prohibits the setting of three or more consecutive or identical special characters. (e.g., !@#, !!!)'));
        o.depends('check_sequential', '1');
        o.default = o.disabled; // Disable

        return m.render();
    }
});
