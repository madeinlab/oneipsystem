'use strict';
'require view';
'require fs';
'require ui';
'require form';

const ICONS = {
    'Log File Path': '🗂️',
    'Size Limit': '📏',
    'Number of Rotations': '🔄',
    'Rotation Directory': '📁',
    'Date Format': '📅',
    'File Permissions': '🔑',
    'Extra Options': '⚙️',
    'Log File Count': '🧮'
};

return view.extend({
    load() {
        // Read logrotate config and count matching files in /mnt/oneip_log
        return Promise.all([
            fs.read('/etc/logrotate.d/system_log'),
            fs.glob('/mnt/oneip_log/systemLOG_*')
        ]).then(function(results) {
            return {
                config: results[0],
                fileCount: Array.isArray(results[1]) ? results[1].length : 0
            };
        }).catch(function(err) {
            ui.addNotification(null, E('p', {}, _('Unable to load log configuration file: ' + err.message)));
            return { config: '', fileCount: 0 };
        });
    },

    render: function(data) {
        var config = this.parseLogrotateConfig(data.config);
        var fileCount = data.fileCount;

        // Extra options 줄바꿈 처리
        let extraLines = config.extra
            ? config.extra.split('\n').map(line => E('div', { 'style': 'font-family:monospace;' }, [line]))
            : [ '-' ];

        return E([], [
            E('h2', { 'style': 'color:#1976d2; margin-bottom:16px;' }, [_('Log Rotation Settings')]),
            E('table', {
                'style': `
                    border-collapse:collapse;
                    width:70%;
                    background:#fafbfc;
                    box-shadow:0 2px 8px #0001;
                    border-radius:8px;
                    overflow:hidden;
                `
            }, [
                this.renderRow('Log File Path', config.log_file),
                this.renderRow('Size Limit', config.size),
                this.renderRow('Number of Rotations', config.rotate),
                this.renderRow('Rotation Directory', config.olddir),
                this.renderRow('Date Format', config.dateformat),
                this.renderRow('File Permissions', config.create),
                this.renderRow('Log File Count', fileCount + ' files'),
                E('tr', {}, [
                    E('th', {
                        'style': `
                            text-align:left;
                            width:200px;
                            background:#e3f2fd;
                            color:#1976d2;
                            padding:10px;
                            border-bottom:1px solid #bbdefb;
                            font-weight:600;
                        `
                    }, [ICONS['Extra Options'] + ' Extra Options']),
                    E('td', {
                        'style': `
                            padding:10px;
                            border-bottom:1px solid #bbdefb;
                            background:#fff;
                        `
                    }, extraLines)
                ])
            ])
        ]);
    },

    renderRow: function(label, value) {
        return E('tr', {}, [
            E('th', {
                'style': `
                    text-align:left;
                    width:200px;
                    background:#e3f2fd;
                    color:#1976d2;
                    padding:10px;
                    border-bottom:1px solid #bbdefb;
                    font-weight:600;
                `
            }, [ICONS[label] + ' ' + label]),
            E('td', {
                'style': `
                    padding:10px;
                    border-bottom:1px solid #bbdefb;
                    background:#fff;
                `
            }, [ value || '-' ])
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
        var inPostrotate = false;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.startsWith('/')) result.log_file = line.split('{')[0].trim();
            else if (line.startsWith('size')) result.size = line.split(' ')[1];
            else if (line.startsWith('rotate')) result.rotate = line.split(' ')[1];
            else if (line.startsWith('olddir')) result.olddir = line.split(' ')[1];
            else if (line.startsWith('dateformat')) result.dateformat = line.split(' ')[1];
            else if (line.startsWith('create')) result.create = line.split(' ').slice(1).join(' ');
            else if (line.startsWith('postrotate')) inPostrotate = true;
            else if (line.startsWith('endscript')) inPostrotate = false;
            else if (inPostrotate || (
                line && !line.startsWith('{') && !line.startsWith('}')
                && !['copytruncate','dateext','missingok','notifempty'].some(k=>line.startsWith(k))
            )) {
                extras.push(line);
            }
        }
        result.extra = extras.join('\n');
        return result;
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
}); 
