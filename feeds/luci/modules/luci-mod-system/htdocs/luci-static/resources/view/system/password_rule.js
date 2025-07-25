'use strict';
'require form';
'require view';
'require uci';
'require ui';

var _default_minlength_min = 9
var _default_maxlength_min = 15

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
                uci.set('admin_manage', sid, 'check_sequential', '1');
                uci.set('admin_manage', sid, 'check_sequential_ignore_case', '1');
                uci.set('admin_manage', sid, 'check_sequential_special', '1');
                return uci.save();
            }
            return Promise.resolve();
        }).catch(err => {
            ui.addNotification(null, E('p', {}, _('Failed to load password rules: ') + err.message));
            return Promise.reject(err);
        });
    },

    render: function() {
        var m = new form.Map('admin_manage', _('Password Rules'),
            _('Configure password length requirements'));

        var s = m.section(form.TypedSection, 'password_rule');
        s.anonymous = true;
        s.addremove = false;

        var o;
        o = s.option(form.Value, 'min_length', _('Minimum Length'), _('Minimum length must be at least %d.').format(_default_minlength_min));
        o.datatype = 'uinteger';
        o.default = '9';
        o.rmempty = false;
        o.min = _default_minlength_min
        o.validate = function(section_id, value) {
            var max = this.map.lookupOption('max_length', section_id)[0].formvalue(section_id);
            var numValue = Number(value);
            var numMax = Number(max);

            if (max && (numValue > numMax)) {
                return _('Minimum length must be less than maximum length.');
            }

            if (numValue < this.min) {
                return _('Minimum length must be at least %d.').format(this.min);
            }
            return true;
        };

        o = s.option(form.Value, 'max_length', _('Maximum Length'), _('Maximum length must be at least %d.').format(_default_maxlength_min));
        o.datatype = 'uinteger';
        o.default = '32';
        o.rmempty = false;
        o.min = _default_maxlength_min
        o.validate = function(section_id, value) {
            var min = this.map.lookupOption('min_length', section_id)[0].formvalue(section_id);
            var numValue = Number(value);
            var numMin = Number(min);

            if (min && (numValue < numMin)) {
                return _('Maximum length must be greater than minimum length.');
            }

            if (numValue < this.min) {
                return _('Maximum length must be at least %d.').format(this.min);
            }

            return true;
        };

        o = s.option(form.Flag, 'check_sequential', _('Check sequential characters'),
            _('Prohibits three or more consecutive or identical characters. (e.g., 123, 111, abc, aaa)'));
        o.rmempty = false;
        o.default = '0';

        o = s.option(form.Flag, 'check_sequential_ignore_case', _('- Ignore case'),
            _('Case insensitive. (e.g., abc, Abc)'));
        o.depends('check_sequential', '1');
        o.default = '0';

        o = s.option(form.Flag, 'check_sequential_special', _('- Check special charaters'),
            _('Prohibits the setting of three or more consecutive or identical special characters. (e.g., !@#, !!!)'));
        o.depends('check_sequential', '1');
        o.default = '0';

        return m.render();
    }
});
