'use strict';
'require form';
'require view';
'require uci';
'require ui';

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('luci')
        ]);
    },

    render: function() {
        var m = new form.Map('luci', _('LuCI Session Configuration'),
            _('Configure LuCI session timeout.'));

        var s = m.section(form.NamedSection, 'sauth', 'luci');
        s.anonymous = true;
        s.addremove = false;

        // 세션 타임아웃 설정
        var o = s.option(form.Value, 'sessiontime', _('Session Timeout'),
            _('Session timeout in seconds (0 for no timeout)'));
        o.datatype = 'uinteger';
        o.default = '600';  // 기본값 10분으로 변경
        o.rmempty = false;
        o.validate = function(section_id, value) {
            var val = parseInt(value);
            if (isNaN(val) || val < 0) {
                return _('Must be a non-negative integer');
            }
            return true;
        };

        return m.render();
    }
}); 