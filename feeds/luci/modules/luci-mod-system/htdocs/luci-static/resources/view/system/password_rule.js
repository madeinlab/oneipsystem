'use strict';
'require form';
'require view';
'require uci';
'require ui';
'require dom';
'require fs';

console.log('[Debug] Script initialized');

var formData = {};

return view.extend({
    load: function() {
        console.log('[Debug] Load function started');
        
        return uci.load('admin')
            .then(function() {
                console.log('[Debug] UCI admin config loaded');
                
                // 현재 UCI 상태 확인
                var sections = uci.sections('admin', 'password_rule');
                console.log('[Debug] Current sections:', sections);

                // password_rule 섹션이 없으면 생성
                if (!sections || sections.length === 0) {
                    console.log('[Debug] Creating new password_rule section');
                    try {
                        uci.add('admin', 'password_rule');
                        uci.set('admin', 'password_rule', 'min_length', '9');
                        uci.set('admin', 'password_rule', 'max_length', '128');  // 128로 수정
                        
                        console.log('[Debug] Saving new UCI config');
                        return uci.save()
                            .then(function() {
                                console.log('[Debug] New UCI config saved');
                                return uci.apply();
                            });
                    } catch (error) {
                        console.error('[Debug] Error creating UCI config:', error);
                        throw error;
                    }
                }
            });
    },

    render: function() {
        console.log('[Debug] Render function started');
        
        var m, s, o;
        var min_length = uci.get('admin', 'password_rule', 'min_length');
        var max_length = uci.get('admin', 'password_rule', 'max_length');
        
        console.log('[Debug] Rendering with values - min:', min_length, 'max:', max_length);

        m = new form.Map('admin', _('Password Rules'),
            _('Configure password length requirements'));
        console.log('[Debug] form.Map created');

        s = m.section(form.TypedSection, 'password_rule');
        s.anonymous = true;
        s.addremove = false;
        console.log('[Debug] TypedSection created');

        o = s.option(form.Value, 'min_length', _('Minimum Length'));
        o.datatype = 'uinteger';
        o.default = min_length || '9';
        o.rmempty = false;
        console.log('[Debug] min_length option created with default:', o.default);

        o = s.option(form.Value, 'max_length', _('Maximum Length'));
        o.datatype = 'uinteger';
        o.default = max_length || '15';
        o.rmempty = false;
        console.log('[Debug] max_length option created with default:', o.default);

        return m.render();
    },

    handleSave: function() {
        console.log('[Debug] Save button clicked');
        var map = document.querySelector('.cbi-map');
        
        return dom.callClassMethod(map, 'save').then(function() {
            console.log('[Debug] Form data collected, starting UCI save');
            return uci.save().then(function() {
                console.log('[Debug] UCI saved successfully');
                return uci.apply().then(function() {
                    console.log('[Debug] UCI applied successfully');
                    ui.addNotification(null, E('p', _('Password rules have been updated.')), 'info');
                });
            });
        }).catch(function(error) {
            console.error('[Debug] Error in save process:', error);
            ui.addNotification(null, E('p', _('Failed to save password rules.')), 'danger');
            throw error;
        });
    },

    handleSaveApply: null,
    handleReset: null
}); 