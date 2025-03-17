'use strict';
'require form';
'require view';
'require uci';
'require ui';
'require fs';

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('admin_manage'),
            uci.load('firewall')
        ]);
    },

    // 기존 AdminIP 방화벽 규칙 모두 삭제
    removeAllAdminIPRules: function() {
        uci.sections('firewall', 'rule', (s) => {
            if (s.name && s.name.startsWith('AdminIP_')) {
                uci.remove('firewall', s['.name']);
            }
        });
        
        return uci.save('firewall')
            .then(() => {
                return fs.exec('/etc/init.d/firewall', ['reload']);
            });
    },

    // 활성화된 IP에 대한 방화벽 규칙 추가
    addFirewallRule: function(ip) {
        let ruleName = 'AdminIP_' + ip.replace(/\./g, '_');
        
        // 새 룰 섹션 추가
        let sid = uci.add('firewall', 'rule', null, {
            name: ruleName,
            src: 'wan',
            src_ip: ip,
            target: 'ACCEPT',
            enabled: '1'
        });

        // 새로 추가된 룰을 첫 번째 위치로 이동
        uci.reorder('firewall', sid, 0);
        
        return uci.save('firewall');
    },

    render: function() {
        var m = new form.Map('admin_manage', _('Admin IP Configuration'),
            _('Configure allowed admin IP addresses.'));

        // IP 목록 테이블
        var s2 = m.section(form.TableSection, 'admin_ip');
        s2.anonymous = true;
        s2.addremove = true;
        s2.sortable = false;
        s2.max_count = 10; // 최대 10개 항목으로 제한

        // 번호 컬럼
        var o = s2.option(form.DummyValue, '_index');
        o.modalonly = false;
        o.width = '10%';
        o.cfgvalue = function(section_id) {
            var sections = this.section.cfgsections();
            return (sections.indexOf(section_id) + 1).toString();
        };

        // IP 주소 입력 컬럼
        o = s2.option(form.Value, 'ipaddr', _('Allowed IP Address'));
        o.modalonly = false;
        o.width = '30%';
        o.datatype = 'ipaddr';
        o.rmempty = false;
        o.placeholder = _('Enter IPv4 address');
        o.validate = function(section_id, value) {
            if (!value || value.trim() === '') {
                return _('IP address is required');
            }
            if (!value.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
                return _('Invalid IP address format');
            }
            
            // IP 주소 형식이 맞더라도 각 부분이 0-255 범위인지 확인
            var parts = value.split('.');
            for (var i = 0; i < parts.length; i++) {
                var part = parseInt(parts[i], 10);
                if (part < 0 || part > 255) {
                    return _('Each part of the IP address must be between 0 and 255');
                }
            }
            
            return true;
        };

        // Description 컬럼 추가
        o = s2.option(form.Value, 'description', _('Description'));
        o.modalonly = false;
        o.width = '30%';
        o.placeholder = _('Enter description');
        o.rmempty = true;  // 설명은 필수가 아님

        // 활성화 체크박스 컬럼
        o = s2.option(form.Flag, 'enabled', _('Enable'));
        o.modalonly = false;
        o.width = '15%';
        o.rmempty = false;
        o.default = '0';

        // 삭제 버튼 비활성화 조건 추가
        s2.renderRowActions = function(section_id) {
            var ipaddr = uci.get('admin_manage', section_id, 'ipaddr');
            
            // 기본 버튼 렌더링 가져오기
            var btns = form.TableSection.prototype.renderRowActions.apply(this, [ section_id ]);
            
            // IP 주소가 비어있으면 삭제 버튼 비활성화
            if (!ipaddr || ipaddr === '') {
                var deleteBtn = btns.querySelector('.cbi-button-remove');
                if (deleteBtn) {
                    deleteBtn.disabled = true;
                    deleteBtn.classList.add('disabled');
                }
            }
            
            return btns;
        };

        // 행 추가 시 처리
        s2.handleAdd = function(ev) {
            var current_count = this.cfgsections().length;
            
            // 최대 항목 수 검사
            if (current_count >= this.max_count) {
                ui.addNotification(null, 
                    E('p', _('Maximum number of entries (%d) reached').format(this.max_count)), 
                    'error'
                );
                return Promise.resolve();
            }
            
            var config_name = this.uciconfig || this.map.config;
            var section_id = uci.add(config_name, this.sectiontype);
            
            uci.set(config_name, section_id, 'enabled', '0');
            uci.set(config_name, section_id, 'ipaddr', '');
            uci.set(config_name, section_id, 'description', '');
            
            return this.map.save()
                .then(L.bind(function() {
                    return this.map.load();
                }, this));
        };

        // 행 삭제 시 처리
        s2.handleRemove = function(section_id, ev) {
            return uci.remove('admin_manage', section_id)
                .then(L.bind(function() {
                    return this.map.save();
                }, this));
        };

        // 추가 버튼 렌더링 오버라이드
        s2.renderSectionAdd = function(extra_class) {
            var current_count = this.cfgsections().length;
            
            // 이미 10개 항목이 있으면 추가 버튼 비활성화
            if (current_count >= this.max_count) {
                return E('div', { 'class': 'cbi-section-create' },
                    E('button', {
                        'class': 'cbi-button cbi-button-add' + (extra_class || ''),
                        'title': _('Maximum number of entries reached (%d)').format(this.max_count),
                        'disabled': 'disabled'
                    }, [ _('Add') ])
                );
            }
            
            return form.TableSection.prototype.renderSectionAdd.apply(this, arguments);
        };

        // 저장 & 적용 시 처리
        m.apply = function() {
            // 저장 전에 빈 IP 주소 항목 제거
            var emptyEntries = [];
            var hasChanges = false;
            
            uci.sections('admin_manage', 'admin_ip', (s) => {
                if (!s.ipaddr || s.ipaddr.trim() === '') {
                    emptyEntries.push(s['.name']);
                    hasChanges = true;
                }
            });
            
            // 빈 항목 제거
            emptyEntries.forEach(section_id => {
                uci.remove('admin_manage', section_id);
            });
            
            // 변경사항이 없으면 메시지 표시
            if (!hasChanges && !this.isDirty()) {
                ui.addNotification(null, E('p', _('No changes to apply')), 'info');
                return Promise.resolve();
            }
            
            return this.save()
                .then(L.bind(function() {
                    // 1. 기존 AdminIP 규칙 모두 삭제
                    return this.data.removeAllAdminIPRules();
                }, this))
                .then(L.bind(function() {
                    // 2. 활성화된 IP에 대해 새 규칙 추가
                    let promises = [];
                    uci.sections('admin_manage', 'admin_ip', (s) => {
                        if (s.enabled === '1' && s.ipaddr) {
                            promises.push(this.data.addFirewallRule(s.ipaddr));
                        }
                    });
                    return Promise.all(promises);
                }, this))
                .then(L.bind(function() {
                    // 3. 방화벽 리로드
                    return fs.exec('/etc/init.d/firewall', ['reload']);
                }, this))
                .then(L.bind(function() {
                    ui.addNotification(null, E('p', _('Admin IP settings have been saved and applied.')), 'info');
                }, this))
                .catch(function(error) {
                    ui.addNotification(null, E('p', _('Failed to apply settings: ') + error), 'error');
                });
        };

        // 저장 전 유효성 검사
        m.validate = function() {
            var validationErrors = [];
            
            // 항목 수 검사
            var sections = uci.sections('admin_manage', 'admin_ip');
            if (sections.length > s2.max_count) {
                validationErrors.push(_('Maximum number of entries (%d) exceeded').format(s2.max_count));
                return validationErrors;
            }
            
            // 모든 IP 주소 항목 검사
            uci.sections('admin_manage', 'admin_ip', (s) => {
                if (!s.ipaddr || s.ipaddr.trim() === '') {
                    validationErrors.push(_('IP address cannot be empty'));
                } else if (!s.ipaddr.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
                    validationErrors.push(_('Invalid IP address format: %s').format(s.ipaddr));
                } else {
                    // IP 주소 형식이 맞더라도 각 부분이 0-255 범위인지 확인
                    var parts = s.ipaddr.split('.');
                    for (var i = 0; i < parts.length; i++) {
                        var part = parseInt(parts[i], 10);
                        if (part < 0 || part > 255) {
                            validationErrors.push(_('Each part of the IP address must be between 0 and 255: %s').format(s.ipaddr));
                            break;
                        }
                    }
                }
            });
            
            if (validationErrors.length) {
                return validationErrors;
            }
            
            return form.Map.prototype.validate.apply(this);
        };

        return m.render();
    }
}); 