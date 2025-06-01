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
        var config = this.parseLogrotateConfig(logdata);

        return E([], [
            E('h2', {}, [_('Log Rotation Settings')]),
            E('table', { 'class': 'table' }, [
                this.renderRow(_('Log File Path'), config.log_file),
                this.renderRow(_('Size Limit'), config.size),
                this.renderRow(_('Number of Rotations'), config.rotate),
                this.renderRow(_('Rotation Directory'), config.olddir),
                this.renderRow(_('Date Format'), config.dateformat),
                this.renderRow(_('File Permissions'), config.create),
                this.renderRow(_('Extra Options'), config.extra)
            ])
        ]);
    },

    renderRow: function(label, value) {
        return E('tr', {}, [
            E('th', { 'style': 'text-align:left;width:200px;' }, [ label ]),
            E('td', {}, [ value || '-' ])
        ]);
    },

    parseLogrotateConfig: function(config) {
        var result = {
            log_file: '',
            size: '',
            rotate: '',
            olddir: '',
            dateformat: '',
            create: '',
            extra: ''
        };
        var lines = config.split('\n');
        var extras = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.startsWith('/')) result.log_file = line.split('{')[0].trim();
            else if (line.startsWith('size')) result.size = line.split(' ')[1];
            else if (line.startsWith('rotate')) result.rotate = line.split(' ')[1];
            else if (line.startsWith('olddir')) result.olddir = line.split(' ')[1];
            else if (line.startsWith('dateformat')) result.dateformat = line.split(' ')[1];
            else if (line.startsWith('create')) result.create = line.split(' ').slice(1).join(' ');
            else if (line && !line.startsWith('{') && !line.startsWith('}')) extras.push(line);
        }
        result.extra = extras.filter(l =>
            !l.startsWith('copytruncate') &&
            !l.startsWith('dateext') &&
            !l.startsWith('missingok') &&
            !l.startsWith('notifempty') &&
            !l.startsWith('postrotate') &&
            !l.startsWith('endscript')
        ).join(', ');
        return result;
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
}); 
