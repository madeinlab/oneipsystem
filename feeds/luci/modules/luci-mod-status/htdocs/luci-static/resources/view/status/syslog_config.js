'use strict';
'require view';
'require fs';
'require ui';
'require form';

return view.extend({
    load() {
        return fs.read('/etc/logrotate.d/system_log')
            .then(function(content) {
                return content;
            })
            .catch(function(err) {
                ui.addNotification(null, E('p', {}, _('Unable to load log configuration file: ' + err.message)));
                return '';
            });
    },

    render: function(logdata) {
        var m, s, o;
        var config = this.parseLogrotateConfig(logdata);

        m = new form.Map('system');
        s = m.section(form.TypedSection, 'logrotate', _('Log Rotation Settings'));
        s.anonymous = true;
        s.addremove = false;

        o = s.option(form.Value, 'log_file', _('Log File Path'));
        o.default = config.log_file;
        o.readonly = true;

        o = s.option(form.Value, 'size', _('Size Limit'));
        o.default = config.size;
        o.readonly = true;

        o = s.option(form.Value, 'rotate', _('Number of Rotations'));
        o.default = config.rotate;
        o.readonly = true;

        o = s.option(form.Value, 'olddir', _('Rotation Directory'));
        o.default = config.olddir;
        o.readonly = true;

        o = s.option(form.Value, 'dateformat', _('Date Format'));
        o.default = config.dateformat;
        o.readonly = true;

        o = s.option(form.Value, 'permissions', _('File Permissions'));
        o.default = config.create;
        o.readonly = true;

        return m.render();
    },

    parseLogrotateConfig: function(config) {
        var result = {
            log_file: '',
            size: '',
            rotate: '',
            olddir: '',
            dateformat: '',
            create: ''
        };

        var lines = config.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            
            if (line.startsWith('/')) {
                result.log_file = line.split('{')[0].trim();
            }
            else if (line.startsWith('size')) {
                result.size = line.split(' ')[1];
            }
            else if (line.startsWith('rotate')) {
                result.rotate = line.split(' ')[1];
            }
            else if (line.startsWith('olddir')) {
                result.olddir = line.split(' ')[1];
            }
            else if (line.startsWith('dateformat')) {
                result.dateformat = line.split(' ')[1];
            }
            else if (line.startsWith('create')) {
                result.create = line.split(' ').slice(1).join(' ');
            }
        }

        return result;
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
}); 
