'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require network';
'require rpc';
'require tools.widgets as widgets';

var isReadonlyView = !L.hasViewPermission() || null;

return view.extend({

	load: function() {
		return Promise.all([
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});