'use strict';
'require form';
'require view';
'require uci';
'require ui';
'require fs';

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('openssh'),
            fs.exec('/etc/init.d/sshd', ['status'])
        ]).then((results) => {
            let sections = uci.sections('openssh', 'sshd');
            if (!sections || sections.length === 0) {
                let sid = uci.add('openssh', 'sshd');
                uci.set('openssh', sid, 'enabled', '0');  // 기본값 Disable
                uci.set('openssh', sid, 'Port', '2222');
                uci.set('openssh', sid, 'PermitRootLogin', 'no');  // 기본값 Disable
                uci.set('openssh', sid, 'PasswordAuthentication', 'yes');
                return uci.save();
            }
            return results[1];
        });
    },

    render: function() {
        var m = new form.Map('openssh', _('OpenSSH Server Configuration'),
            _('Configure OpenSSH server settings. Note: This is separate from Dropbear SSH server.'));

        var s = m.section(form.NamedSection, 'sshd', 'openssh');
        s.anonymous = true;
        s.addremove = false;

        // 기본 설정
        var o = s.option(form.Flag, 'enabled', _('Enable OpenSSH Server'));
        o.rmempty = false;
        o.default = '0';  // Disable
        o.write = function(section_id, value) {
            uci.set('openssh', section_id, 'enabled', value);
            if (value == '1') {
                fs.exec('/etc/init.d/sshd', ['enable']);
                fs.exec('/etc/init.d/sshd', ['start']);
            } else {
                fs.exec('/etc/init.d/sshd', ['disable']);
                fs.exec('/etc/init.d/sshd', ['stop']);
            }
        };

        o = s.option(form.Value, 'Port', _('SSH Port'));
        o.datatype = 'port';
        o.default = '2222';
        o.rmempty = false;

        // 접근 제어 설정
        o = s.option(form.Flag, 'PermitRootLogin', _('Allow root login'));
        o.enabled = 'yes';
        o.disabled = 'no';
        o.default = o.disabled;  // Disable
        o.rmempty = false;

        o = s.option(form.Flag, 'PasswordAuthentication', _('Password authentication'));
        o.enabled = 'yes';
        o.disabled = 'no';
        o.default = o.enabled;  // Enable
        o.rmempty = false;

        o = s.option(form.Value, 'ListenAddress', _('Listen Address'));
        o.datatype = 'ipaddr';
        o.placeholder = '0.0.0.0';
        o.default = '0.0.0.0';
        o.rmempty = false;

        // 인증 설정
        o = s.option(form.Flag, 'PubkeyAuthentication', _('Public key authentication'));
        o.enabled = 'yes';
        o.disabled = 'no';
        o.default = o.enabled;  // Enable
        o.rmempty = false;

        o = s.option(form.Value, 'AuthorizedKeysFile', _('Authorized keys file'));
        o.default = '.ssh/authorized_keys';
        o.rmempty = false;

        o = s.option(form.Flag, 'UsePAM', _('Use PAM authentication'));
        o.enabled = 'yes';
        o.disabled = 'no';
        o.default = o.enabled;  // Enable
        o.rmempty = false;

        o = s.option(form.Value, 'MaxAuthTries', _('Max authentication tries'));
        o.datatype = 'uinteger';
        o.default = '3';
        o.rmempty = false;

        return m.render();
    }
}); 