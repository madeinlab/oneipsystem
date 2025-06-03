'use strict';
'require view';
'require fs';
'require ui';
'require form';
'require poll';

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

function fetchData() {
    return Promise.all([
        fs.read('/etc/logrotate.d/system_log'),
        fs.list('/mnt/oneip_log')
    ]).then(function(results) {
        // Count files starting with systemLOG_
        let files = Array.isArray(results[1]) ? results[1] : [];
        let count = files.filter(f => f.name && f.name.startsWith('system.log_')).length;
        return {
            config: results[0],
            fileCount: count
        };
    }).catch(function(err) {
        ui.addNotification(null, E('p', {}, _('Unable to load log configuration file: ' + err.message)));
        return { config: '', fileCount: 0 };
    });
}

function updateFileCountIndicator(fileCount, rotateLimit) {
    var prev = document.getElementById('filecount-indicator');
    if (prev) prev.remove();

    let icon, tooltip;
    if (fileCount >= rotateLimit) {
        icon = '⛔';
        tooltip = `CRITICAL! Log file count is too high (${fileCount} files, limit: ${rotateLimit}). Old data will be deleted.`;
    } else if (fileCount >= rotateLimit * 0.9) {  // 90% 이상
        icon = '🔴';
        tooltip = `WARNING! Log file count is high (${fileCount} files, limit: ${rotateLimit}).`;
    } else if (fileCount >= rotateLimit * 0.8) {  // 80% 이상
        icon = '⚠️';
        tooltip = `WARNING! Log file count is high (${fileCount} files, limit: ${rotateLimit}).`;
    } else {
        icon = '🟢';
        tooltip = 'Log file count is within safe range.';
    }

    var indicator = E('span', {
        id: 'filecount-indicator',
        title: tooltip,
        style: 'display:inline-flex; align-items:center; border:1px solid #1976d2; background:none; border-radius:1em; padding:2px 10px; margin-left:8px; font-size:14px; color:#1565c0; font-weight:500;'
    }, [
        E('span', { style: 'font-size:14px; vertical-align:middle; background:none; border:none; padding:0; border-radius:0;' }, icon),
        E('span', { style: 'font-size:14px; margin-left:6px; color:#1565c0; vertical-align:middle; background:none; border:none; padding:0; border-radius:0;' }, `Log file #${fileCount}`)
    ]);

    // 'indicators' 영역이 갱신중 옆에 위치한다고 가정
    var indicators = document.getElementById('indicators');
    if (indicators) indicators.appendChild(indicator);
}

return view.extend({
    load: fetchData,

    render: function(data) {
        var self = this;
        var config = this.parseLogrotateConfig(data.config);
        var fileCount = data.fileCount;
        var rotateLimit = parseInt(config.rotate) || 40;

        // indicator 추가
        updateFileCountIndicator(fileCount, rotateLimit);

        // Extra options line break handling
        let extraLines = config.extra
            ? config.extra.split('\n').map(line => E('div', { 'style': 'font-family:monospace;' }, [line]))
            : [ '-' ];

        // Table
        let table = E('table', {
            'style': `
                border-collapse:collapse;
                width:100%;
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
                        width:300px;
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
                        width:100%;
                    `
                }, extraLines)
            ])
        ]);

        // Polling function
        function pollStep() {
            return fetchData().then(function(newData) {
                var newConfig = self.parseLogrotateConfig(newData.config);
                var newFileCount = newData.fileCount;
                var newRotateLimit = parseInt(newConfig.rotate) || 40;

                // Update table cells
                var rows = table.querySelectorAll('tr');
                if (rows.length >= 7) {
                    rows[0].lastChild.textContent = newConfig.log_file || '-';
                    rows[1].lastChild.textContent = newConfig.size || '-';
                    rows[2].lastChild.textContent = newConfig.rotate || '-';
                    rows[3].lastChild.textContent = newConfig.olddir || '-';
                    rows[4].lastChild.textContent = newConfig.dateformat || '-';
                    rows[5].lastChild.textContent = newConfig.create || '-';
                    rows[6].lastChild.textContent = newFileCount + ' files';
                    // Extra options
                    let extraCell = rows[7].lastChild;
                    extraCell.innerHTML = '';
                    (newConfig.extra
                        ? newConfig.extra.split('\n').map(line => E('div', { 'style': 'font-family:monospace;' }, [line]))
                        : [ '-' ]
                    ).forEach(el => extraCell.appendChild(el));
                }

                // indicator 갱신
                updateFileCountIndicator(newFileCount, newRotateLimit);
            });
        }

        // Register poll
        poll.add(pollStep);

        // Render
        return E([], [
            E('h2', { 'style': 'color:#1976d2; margin-bottom:8px;' }, [_('Log Rotation Settings')]),
            table
        ]);
    },

    renderRow: function(label, value) {
        return E('tr', {}, [
            E('th', {
                'style': `
                    text-align:left;
                    width:20%;
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
                    width:100%;
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
