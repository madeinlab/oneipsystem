'use strict';
'require view';
'require fs';
'require ui';
'require rpc';

var css = '								\
	.controls {							\
		display: flex;					\
		margin: .5em 0 1em 0;			\
		flex-wrap: wrap;				\
		justify-content: space-around;	\
	}									\
										\
	.controls > * {						\
		padding: .25em;					\
		white-space: nowrap;			\
		flex: 1 1 33%;					\
		box-sizing: border-box;			\
		display: flex;					\
		flex-wrap: wrap;				\
	}									\
										\
	.controls > *:first-child,			\
	.controls > * > label {				\
		flex-basis: 100%;				\
		min-width: 250px;				\
	}									\
										\
	.controls > *:nth-child(2),			\
	.controls > *:nth-child(3) {		\
		flex-basis: 20%;				\
	}									\
										\
	.controls > * > .btn {				\
		flex-basis: 20px;				\
		text-align: center;				\
	}									\
										\
	.controls > * > * {					\
		flex-grow: 1;					\
		align-self: center;				\
	}									\
										\
	.controls > div > input {			\
		width: auto;					\
	}									\
										\
	.td.version,						\
	.td.size {							\
		white-space: nowrap;			\
	}									\
										\
	ul.deps, ul.deps ul, ul.errors {	\
		margin-left: 1em;				\
	}									\
										\
	ul.deps li, ul.errors li {			\
		list-style: none;				\
	}									\
										\
	ul.deps li:before {					\
		content: "↳";					\
		display: inline-block;			\
		width: 1em;						\
		margin-left: -1em;				\
	}									\
										\
	ul.deps li > span {					\
		white-space: nowrap;			\
	}									\
										\
	ul.errors li {						\
		color: #c44;					\
		font-size: 90%;					\
		font-weight: bold;				\
		padding-left: 1.5em;			\
	}									\
										\
	ul.errors li:before {				\
		content: "⚠";					\
		display: inline-block;			\
		width: 1.5em;					\
		margin-left: -1.5em;			\
	}									\
';

var isReadonlyView = !L.hasViewPermission() || null;

var callMountPoints = rpc.declare({
	object: 'luci',
	method: 'getMountPoints',
	expect: { result: [] }
});

var packages = {
	available: { providers: {}, pkgs: {} },
	installed: { providers: {}, pkgs: {} }
};

var currentDisplayMode = 'installed';
var currentDisplayRows = [];

function parseList(s, dest)
{
	if (!s || typeof s !== 'string') {
		console.error('Invalid input for parseList:', s);
		return;
	}

	try {
		var re = /([^\n]*)\n/g,
			pkg = null, key = null, val = null, m;

		while ((m = re.exec(s)) !== null) {
			if (m[1].match(/^\s(.*)$/)) {
				if (pkg !== null && key !== null && val !== null)
					val += '\n' + RegExp.$1.trim();

				continue;
			}

			if (key !== null && val !== null) {
				switch (key) {
				case 'package':
					pkg = { name: val };
					break;

				case 'depends':
				case 'provides':
					var list = val.split(/\s*,\s*/);
					if (list.length !== 1 || list[0].length > 0)
						pkg[key] = list;
					break;

				case 'installed-time':
					pkg.installtime = new Date(+val * 1000);
					break;

				case 'installed-size':
					pkg.installsize = +val;
					break;

				case 'status':
					var stat = val.split(/\s+/),
						mode = stat[1],
						installed = stat[2];

					switch (mode) {
					case 'user':
					case 'hold':
						pkg[mode] = true;
						break;
					}

					switch (installed) {
					case 'installed':
						pkg.installed = true;
						break;
					}
					break;

				case 'essential':
					if (val === 'yes')
						pkg.essential = true;
					break;

				case 'size':
					pkg.size = +val;
					break;

				case 'architecture':
				case 'auto-installed':
				case 'filename':
				case 'sha256sum':
				case 'section':
					break;

				default:
					pkg[key] = val;
					break;
				}

				key = val = null;
			}

			if (m[1].trim().match(/^([\w-]+)\s*:(.+)$/)) {
				key = RegExp.$1.toLowerCase();
				val = RegExp.$2.trim();
			}
			else if (pkg) {
				dest.pkgs[pkg.name] = pkg;

				var provides = dest.providers[pkg.name] ? [] : [ pkg.name ];

				if (pkg.provides)
					provides.push.apply(provides, pkg.provides);

				provides.forEach(function(p) {
					dest.providers[p] = dest.providers[p] || [];
					dest.providers[p].push(pkg);
				});
			}
		}
	} catch (e) {
		console.error('Error parsing package list:', e);
		ui.addNotification(null, E('p', {}, _('Failed to parse package information')));
	}
}

function display(pattern)
{
	var src = packages.installed;
	var table = document.querySelector('#packages');
	var ver;

	currentDisplayRows.length = 0;

	for (var name in src.pkgs) {
		var pkg = src.pkgs[name];
		var desc = pkg.description || '';

		if (!pkg.installed)
			continue;

		// nginx, ssh, ssl related packages only
		if (!name.match(/(nginx|ssh|ssl)/i))
			continue;

		desc = desc.split(/\n/);
		desc = desc[0].trim() + (desc.length > 1 ? '…' : '');

		ver = truncateVersion(pkg.version || '-');

		var row = E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, [ name ]),
			E('td', { 'class': 'td version' }, [ ver ]),
			E('td', { 'class': 'td size' }, [ pkg.size ? '%.1024mB'.format(pkg.size) : '-' ]),
			E('td', { 'class': 'td' }, [ desc ])
		]);

		currentDisplayRows.push(row);
	}

	cbi_update_table(table, currentDisplayRows);
}

function handlePage(ev)
{
	var filter = document.querySelector('input[name="filter"]'),
	    pager = ev.target.parentNode,
	    offset = +pager.getAttribute('data-offset'),
	    next = ev.target.classList.contains('next');

	if ((next && (offset + 100) >= currentDisplayRows.length) ||
	    (!next && (offset < 100)))
	    return;

	offset += next ? 100 : -100;
	pager.setAttribute('data-offset', offset);
	pager.querySelector('.text').firstChild.data = currentDisplayRows.length
		? _('Displaying %d-%d of %d').format(1 + offset, Math.min(offset + 100, currentDisplayRows.length), currentDisplayRows.length)
		: _('No packages');

	if (offset < 100)
		pager.querySelector('.prev').setAttribute('disabled', 'disabled');
	else
		pager.querySelector('.prev').removeAttribute('disabled');

	if ((offset + 100) >= currentDisplayRows.length)
		pager.querySelector('.next').setAttribute('disabled', 'disabled');
	else
		pager.querySelector('.next').removeAttribute('disabled');

	var placeholder = _('No information available');

	if (filter.value)
		placeholder = [
			E('span', {}, _('No packages matching "<strong>%h</strong>".').format(filter.value)), ' (',
			E('a', { href: '#', click: handleReset }, _('Reset')), ')'
		];

	cbi_update_table('#packages', currentDisplayRows.slice(offset, offset + 100),
		placeholder);
}

function handleMode(ev)
{
	var tab = findParent(ev.target, 'li');
	if (tab.getAttribute('data-mode') === currentDisplayMode)
		return;

	tab.parentNode.querySelectorAll('li').forEach(function(li) {
		li.classList.remove('cbi-tab');
		li.classList.add('cbi-tab-disabled');
	});

	tab.classList.remove('cbi-tab-disabled');
	tab.classList.add('cbi-tab');

	currentDisplayMode = tab.getAttribute('data-mode');

	display(document.querySelector('input[name="filter"]').value);

	ev.target.blur();
	ev.preventDefault();
}

function orderOf(c)
{
	if (c === '~')
		return -1;
	else if (c === '' || c >= '0' && c <= '9')
		return 0;
	else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'))
		return c.charCodeAt(0);
	else
		return c.charCodeAt(0) + 256;
}

function compareVersion(val, ref)
{
	var vi = 0, ri = 0,
	    isdigit = { 0:1, 1:1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:1, 8:1, 9:1 };

	val = val || '';
	ref = ref || '';

	if (val === ref)
		return 0;

	while (vi < val.length || ri < ref.length) {
		var first_diff = 0;

		while ((vi < val.length && !isdigit[val.charAt(vi)]) ||
		       (ri < ref.length && !isdigit[ref.charAt(ri)])) {
			var vc = orderOf(val.charAt(vi)), rc = orderOf(ref.charAt(ri));
			if (vc !== rc)
				return vc - rc;

			vi++; ri++;
		}

		while (val.charAt(vi) === '0')
			vi++;

		while (ref.charAt(ri) === '0')
			ri++;

		while (isdigit[val.charAt(vi)] && isdigit[ref.charAt(ri)]) {
			first_diff = first_diff || (val.charCodeAt(vi) - ref.charCodeAt(ri));
			vi++; ri++;
		}

		if (isdigit[val.charAt(vi)])
			return 1;
		else if (isdigit[ref.charAt(ri)])
			return -1;
		else if (first_diff)
			return first_diff;
	}

	return 0;
}

function versionSatisfied(ver, ref, vop)
{
	var r = compareVersion(ver, ref);

	switch (vop) {
	case '<':
	case '<=':
		return r <= 0;

	case '>':
	case '>=':
		return r >= 0;

	case '<<':
		return r < 0;

	case '>>':
		return r > 0;

	case '=':
		return r == 0;
	}

	return false;
}

function pkgStatus(pkg, vop, ver, info)
{
	info.errors = info.errors || [];
	info.install = info.install || [];

	if (pkg.installed) {
		if (vop && !versionSatisfied(pkg.version, ver, vop)) {
			var repl = null;

			(packages.available.providers[pkg.name] || []).forEach(function(p) {
				if (!repl && versionSatisfied(p.version, ver, vop))
					repl = p;
			});

			if (repl) {
				info.install.push(repl);
				return E('span', {
					'class': 'label',
					'data-tooltip': _('Requires update to %h %h')
						.format(repl.name, repl.version)
				}, _('Needs upgrade'));
			}

			info.errors.push(_('The installed version of package <em>%h</em> is not compatible, require %s while %s is installed.').format(pkg.name, truncateVersion(ver, vop), truncateVersion(pkg.version)));

			return E('span', {
				'class': 'label warning',
				'data-tooltip': _('Require version %h %h,\ninstalled %h')
					.format(vop, ver, pkg.version)
			}, _('Version incompatible'));
		}

		return E('span', { 'class': 'label notice' }, _('Installed'));
	}
	else if (!pkg.missing) {
		if (!vop || versionSatisfied(pkg.version, ver, vop)) {
			info.install.push(pkg);
			return E('span', { 'class': 'label' }, _('Not installed'));
		}

		info.errors.push(_('The repository version of package <em>%h</em> is not compatible, require %s but only %s is available.')
				.format(pkg.name, truncateVersion(ver, vop), truncateVersion(pkg.version)));

		return E('span', {
			'class': 'label warning',
			'data-tooltip': _('Require version %h %h,\ninstalled %h')
				.format(vop, ver, pkg.version)
		}, _('Version incompatible'));
	}
	else {
		info.errors.push(_('Required dependency package <em>%h</em> is not available in any repository.').format(pkg.name));

		return E('span', { 'class': 'label warning' }, _('Not available'));
	}
}

function renderDependencyItem(dep, info)
{
	var li = E('li'),
	    vop = dep.version ? dep.version[0] : null,
	    ver = dep.version ? dep.version[1] : null,
	    depends = [];

	for (var i = 0; dep.pkgs && i < dep.pkgs.length; i++) {
		var pkg = packages.installed.pkgs[dep.pkgs[i]] ||
		          packages.available.pkgs[dep.pkgs[i]] ||
		          { name: dep.name };

		if (i > 0)
			li.appendChild(document.createTextNode(' | '));

		var text = pkg.name;

		if (pkg.installsize)
			text += ' (%.1024mB)'.format(pkg.installsize);
		else if (pkg.size)
			text += ' (~%.1024mB)'.format(pkg.size);

		li.appendChild(E('span', { 'data-tooltip': pkg.description },
			[ text, ' ', pkgStatus(pkg, vop, ver, info) ]));

		(pkg.depends || []).forEach(function(d) {
			if (depends.indexOf(d) === -1)
				depends.push(d);
		});
	}

	if (!li.firstChild)
		li.appendChild(E('span', {},
			[ dep.name, ' ',
			  pkgStatus({ name: dep.name, missing: true }, vop, ver, info) ]));

	var subdeps = renderDependencies(depends, info);
	if (subdeps)
		li.appendChild(subdeps);

	return li;
}

function renderDependencies(depends, info)
{
	var deps = depends || [],
	    items = [];

	info.seen = info.seen || [];

	for (var i = 0; i < deps.length; i++) {
		var dep, vop, ver;

		if (deps[i] === 'libc')
			continue;

		if (deps[i].match(/^(.+?)\s+\((<=|>=|<<|>>|<|>|=)(.+?)\)/)) {
			dep = RegExp.$1.trim();
			vop = RegExp.$2.trim();
			ver = RegExp.$3.trim();
		}
		else {
			dep = deps[i].trim();
			vop = ver = null;
		}

		if (info.seen[dep])
			continue;

		var pkgs = [];

		(packages.installed.providers[dep] || []).forEach(function(p) {
			if (pkgs.indexOf(p.name) === -1) pkgs.push(p.name);
		});

		(packages.available.providers[dep] || []).forEach(function(p) {
			if (pkgs.indexOf(p.name) === -1) pkgs.push(p.name);
		});

		info.seen[dep] = {
			name:    dep,
			pkgs:    pkgs,
			version: [vop, ver]
		};

		items.push(renderDependencyItem(info.seen[dep], info));
	}

	if (items.length)
		return E('ul', { 'class': 'deps' }, items);

	return null;
}

function truncateVersion(v, op)
{
	v = v.replace(/\b(([a-f0-9]{8})[a-f0-9]{24,32})\b/,
		'<span data-tooltip="$1">$2…</span>');

	if (!op || op === '=')
		return v;

	return '%h %h'.format(op, v);
}

function handleReset(ev)
{
	var filter = document.querySelector('input[name="filter"]');

	filter.value = '';
	display();
}

function handleInstall(ev)
{
	var name = ev.target.getAttribute('data-package'),
	    pkg = packages.available.pkgs[name],
	    depcache = {},
	    size;

	if (pkg.installsize)
		size = _('~%.1024mB installed').format(pkg.installsize);
	else if (pkg.size)
		size = _('~%.1024mB compressed').format(pkg.size);
	else
		size = _('unknown');

	var deps = renderDependencies(pkg.depends, depcache),
	    tree = null, errs = null, inst = null, desc = null;

	if (depcache.errors && depcache.errors.length) {
		errs = E('ul', { 'class': 'errors' });
		depcache.errors.forEach(function(err) {
			errs.appendChild(E('li', {}, err));
		});
	}

	var totalsize = pkg.installsize || pkg.size || 0,
	    totalpkgs = 1;

	if (depcache.install && depcache.install.length)
		depcache.install.forEach(function(ipkg) {
			totalsize += ipkg.installsize || ipkg.size || 0;
			totalpkgs++;
		});

	inst = E('p', {},
		_('Require approx. %.1024mB size for %d package(s) to install.')
			.format(totalsize, totalpkgs));

	if (deps) {
		tree = E('li', '<strong>%s:</strong>'.format(_('Dependencies')));
		tree.appendChild(deps);
	}

	if (pkg.description) {
		desc = E('div', {}, [
			E('h5', {}, _('Description')),
			E('p', {}, pkg.description)
		]);
	}

	ui.showModal(_('Details for package <em>%h</em>').format(pkg.name), [
		E('ul', {}, [
			E('li', '<strong>%s:</strong> %h'.format(_('Version'), pkg.version)),
			E('li', '<strong>%s:</strong> %h'.format(_('Size'), size)),
			tree || '',
		]),
		desc || '',
		errs || inst || '',
		E('div', { 'class': 'right' }, [
			E('label', { 'class': 'cbi-checkbox', 'style': 'float:left' }, [
				E('input', { 'id': 'overwrite-cb', 'type': 'checkbox', 'name': 'overwrite', 'disabled': isReadonlyView }), ' ',
				E('label', { 'for': 'overwrite-cb' }), ' ',
				_('Overwrite files from other package(s)')
			]),
			E('div', {
				'class': 'btn',
				'click': ui.hideModal
			}, _('Cancel')),
			' ',
			E('div', {
				'data-command': 'install',
				'data-package': name,
				'class': 'btn cbi-button-action',
				'click': handleOpkg,
				'disabled': isReadonlyView
			}, _('Install'))
		])
	]);
}

function handleManualInstall(ev)
{
	var name_or_url = document.querySelector('input[name="install"]').value,
	    install = E('div', {
			'class': 'btn cbi-button-action',
			'data-command': 'install',
			'data-package': name_or_url,
			'click': function(ev) {
				document.querySelector('input[name="install"]').value = '';
				handleOpkg(ev);
			}
		}, _('Install')), warning;

	if (!name_or_url.length) {
		return;
	}
	else if (name_or_url.indexOf('/') !== -1) {
		warning = E('p', {}, _('Installing packages from untrusted sources is a potential security risk! Really attempt to install <em>%h</em>?').format(name_or_url));
	}
	else if (!packages.available.providers[name_or_url]) {
		warning = E('p', {}, _('The package <em>%h</em> is not available in any configured repository.').format(name_or_url));
		install = '';
	}
	else {
		warning = E('p', {}, _('Really attempt to install <em>%h</em>?').format(name_or_url));
	}

	ui.showModal(_('Manually install package'), [
		warning,
		E('div', { 'class': 'right' }, [
			E('div', {
				'click': ui.hideModal,
				'class': 'btn cbi-button-neutral'
			}, _('Cancel')),
			' ', install
		])
	]);
}

function handleConfig(ev)
{
	var conf = {};

	ui.showModal(_('OPKG Configuration'), [
		E('p', { 'class': 'spinning' }, _('Loading configuration data…'))
	]);

	fs.list('/etc/opkg').then(function(partials) {
		var files = [ '/etc/opkg.conf' ];

		for (var i = 0; i < partials.length; i++)
			if (partials[i].type == 'file' && partials[i].name.match(/\.conf$/))
				files.push('/etc/opkg/' + partials[i].name);

		return Promise.all(files.map(function(file) {
			return fs.read(file)
				.then(L.bind(function(conf, file, res) { conf[file] = res }, this, conf, file))
				.catch(function(err) {
					ui.addNotification(null, E('p', {}, [ _('Unable to read %s: %s').format(file, err) ]));
					ui.hideModal();
					throw err;
				});
		}));
	}).then(function() {
		var body = [
			E('p', {}, _('Below is a listing of the various configuration files used by <em>opkg</em>. Use <em>opkg.conf</em> for global settings and <em>customfeeds.conf</em> for custom repository entries. The configuration in the other files may be changed but is usually not preserved by <em>sysupgrade</em>.'))
		];

		Object.keys(conf).sort().forEach(function(file) {
			body.push(E('h5', {}, '%h'.format(file)));
			body.push(E('textarea', {
				'name': file,
				'rows': Math.max(Math.min(L.toArray(conf[file].match(/\n/g)).length, 10), 3)
			}, '%h'.format(conf[file])));
		});

		body.push(E('div', { 'class': 'right' }, [
			E('div', {
				'class': 'btn cbi-button-neutral',
				'click': ui.hideModal
			}, _('Cancel')),
			' ',
			E('div', {
				'class': 'btn cbi-button-positive',
				'click': function(ev) {
					var data = {};
					findParent(ev.target, '.modal').querySelectorAll('textarea[name]')
						.forEach(function(textarea) {
							data[textarea.getAttribute('name')] = textarea.value
						});

					ui.showModal(_('OPKG Configuration'), [
						E('p', { 'class': 'spinning' }, _('Saving configuration data…'))
					]);

					Promise.all(Object.keys(data).map(function(file) {
						return fs.write(file, data[file]).catch(function(err) {
							ui.addNotification(null, E('p', {}, [ _('Unable to save %s: %s').format(file, err) ]));
						});
					})).then(ui.hideModal);
				},
				'disabled': isReadonlyView
			}, _('Save')),
		]));

		ui.showModal(_('OPKG Configuration'), body);
	});
}

function handleRemove(ev)
{
	var name = ev.target.getAttribute('data-package'),
	    pkg = packages.installed.pkgs[name],
	    avail = packages.available.pkgs[name] || {},
	    size, desc;

	if (avail.installsize)
		size = _('~%.1024mB installed').format(avail.installsize);
	else if (avail.size)
		size = _('~%.1024mB compressed').format(avail.size);
	else
		size = _('unknown');

	if (avail.description) {
		desc = E('div', {}, [
			E('h5', {}, _('Description')),
			E('p', {}, avail.description)
		]);
	}

	ui.showModal(_('Remove package <em>%h</em>').format(pkg.name), [
		E('ul', {}, [
			E('li', '<strong>%s:</strong> %h'.format(_('Version'), pkg.version)),
			E('li', '<strong>%s:</strong> %h'.format(_('Size'), size))
		]),
		desc || '',
		E('div', { 'style': 'display:flex; justify-content:space-between; flex-wrap:wrap' }, [
			E('label', { 'class': 'cbi-checkbox', 'style': 'float:left' }, [
				E('input', { 'id': 'autoremove-cb', 'type': 'checkbox', 'checked': 'checked', 'name': 'autoremove', 'disabled': isReadonlyView }), ' ',
				E('label', { 'for': 'autoremove-cb' }), ' ',
				_('Automatically remove unused dependencies')
			]),
			E('div', { 'style': 'flex-grow:1', 'class': 'right' }, [
				E('div', {
					'class': 'btn',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('div', {
					'data-command': 'remove',
					'data-package': name,
					'class': 'btn cbi-button-negative',
					'click': handleOpkg,
					'disabled': isReadonlyView
				}, _('Remove'))
			])
		])
	]);
}

function handleOpkg(ev)
{
	return new Promise(function(resolveFn, rejectFn) {
		var cmd = ev.target.getAttribute('data-command'),
		    pkg = ev.target.getAttribute('data-package'),
		    rem = document.querySelector('input[name="autoremove"]'),
		    owr = document.querySelector('input[name="overwrite"]');

		var dlg = ui.showModal(_('Executing package manager'), [
			E('p', { 'class': 'spinning' },
				_('Waiting for the <em>opkg %h</em> command to complete…').format(cmd))
		]);

		var argv = [ cmd, '--force-removal-of-dependent-packages' ];

		if (rem && rem.checked)
			argv.push('--autoremove');

		if (owr && owr.checked)
			argv.push('--force-overwrite');

		if (pkg != null)
			argv.push(pkg);

		fs.exec_direct('/usr/libexec/opkg-call', argv, 'json').then(function(res) {
			dlg.removeChild(dlg.lastChild);

			if (res.stdout)
				dlg.appendChild(E('pre', [ res.stdout ]));

			if (res.stderr) {
				dlg.appendChild(E('h5', _('Errors')));
				dlg.appendChild(E('pre', { 'class': 'errors' }, [ res.stderr ]));
			}

			if (res.code !== 0)
				dlg.appendChild(E('p', _('The <em>opkg %h</em> command failed with code <code>%d</code>.').format(cmd, (res.code & 0xff) || -1)));

			dlg.appendChild(E('div', { 'class': 'right' },
				E('div', {
					'class': 'btn',
					'click': L.bind(function(res) {
						if (ui.menu && ui.menu.flushCache)
							ui.menu.flushCache();

						ui.hideModal();
						updateLists();

						if (res.code !== 0)
							rejectFn(new Error(res.stderr || 'opkg error %d'.format(res.code)));
						else
							resolveFn(res);
					}, this, res)
				}, _('Dismiss'))));
		}).catch(function(err) {
			ui.addNotification(null, E('p', _('Unable to execute <em>opkg %s</em> command: %s').format(cmd, err)));
			ui.hideModal();
		});
	});
}

function handleUpload(ev)
{
	var path = '/tmp/upload.ipk';
	return ui.uploadFile(path).then(L.bind(function(btn, res) {
		ui.showModal(_('Manually install package'), [
			E('p', {}, _('Installing packages from untrusted sources is a potential security risk! Really attempt to install <em>%h</em>?').format(res.name)),
			E('ul', {}, [
				res.size ? E('li', {}, '%s: %1024.2mB'.format(_('Size'), res.size)) : '',
				res.checksum ? E('li', {}, '%s: %s'.format(_('MD5'), res.checksum)) : '',
				res.sha256sum ? E('li', {}, '%s: %s'.format(_('SHA256'), res.sha256sum)) : ''
			]),
			E('div', { 'class': 'right' }, [
				E('div', {
					'click': function(ev) {
						ui.hideModal();
						fs.remove(path);
					},
					'class': 'btn cbi-button-neutral'
				}, _('Cancel')), ' ',
				E('div', {
					'class': 'btn cbi-button-action',
					'data-command': 'install',
					'data-package': path,
					'click': function(ev) {
						handleOpkg(ev).finally(function() {
							fs.remove(path)
						});
					}
				}, _('Install'))
			])
		]);
	}, this, ev.target));
}

function downloadLists()
{
	return Promise.all([
		callMountPoints(),
		fs.exec_direct('/usr/libexec/opkg-call', [ 'list-available' ])
			.catch(function(err) {
				console.error('Failed to list available packages:', err);
				return '';
			}),
		fs.exec_direct('/usr/libexec/opkg-call', [ 'list-installed' ])
			.catch(function(err) {
				console.error('Failed to list installed packages:', err);
				return '';
			})
	]).catch(function(err) {
		console.error('Error downloading package lists:', err);
		ui.addNotification(null, E('p', {}, _('Failed to download package lists')));
		return [{ size: 0, free: 0 }, '', ''];
	});
}

function updateLists(data)
{
	cbi_update_table('#packages', [],
		E('div', { 'class': 'spinning' }, _('Loading package information…')));

	packages.available = { providers: {}, pkgs: {} };
	packages.installed = { providers: {}, pkgs: {} };

	return (data ? Promise.resolve(data) : downloadLists())
		.then(function(data) {
			try {
				if (!Array.isArray(data[0])) {
					throw new Error('Invalid mount point data');
				}

				var pg = document.querySelector('.cbi-progressbar');
				if (!pg) {
					throw new Error('Progress bar element not found');
				}

				var mount = L.toArray(data[0].filter(function(m) { 
					return m.mount == '/' || m.mount == '/overlay' 
				})).sort(function(a, b) { 
					return a.mount > b.mount 
				})[0] || { size: 0, free: 0 };

				pg.firstElementChild.style.width = Math.floor(mount.size ? ((100 / mount.size) * mount.free) : 100) + '%';
				pg.setAttribute('title', '%s (%.1024mB)'.format(pg.firstElementChild.style.width, mount.free));

				if (data[1]) parseList(data[1], packages.available);
				if (data[2]) parseList(data[2], packages.installed);

				display(document.querySelector('input[name="filter"]').value);

			} catch (e) {
				console.error('Error in updateLists:', e);
				ui.addNotification(null, E('p', {}, _('Failed to process package information: ' + e.message)));
			}
		})
		.catch(function(err) {
			console.error('Failed to update lists:', err);
			ui.addNotification(null, E('p', {}, _('Failed to update package information')));
		});
}

var keyTimeout = null;

function handleKeyUp(ev) {
	if (keyTimeout !== null)
		window.clearTimeout(keyTimeout);

	keyTimeout = window.setTimeout(function() {
		display(ev.target.value);
	}, 250);
}

return view.extend({
	load: function() {
		return Promise.all([
			// ACL permission-based opkg-call usage
			L.resolveDefault(fs.exec_direct('/usr/libexec/opkg-call', ['list-installed']), ''),
			// Get disk capacity information
			L.resolveDefault(callMountPoints(), [])
		]);
	},

	render: function(data) {
		var installed = data[0] || '',
		    mountPoints = data[1] || [],
		    rootInfo = null;
		
		// Find root partition information
		for (var i = 0; i < mountPoints.length; i++) {
			if (mountPoints[i].mount === '/' || mountPoints[i].mount === '/overlay') {
				rootInfo = mountPoints[i];
				break;
			}
		}
		
		var size = rootInfo ? rootInfo.size : 0,
		    free = rootInfo ? rootInfo.free : 0,
		    used = size - free;
		
		// Convert capacity information to MB units
		var freeMB = (free / 1048576).toFixed(1),
		    sizeMB = (size / 1048576).toFixed(1);
		
		// Create capacity graph
		var freePercent = size ? Math.floor((free / size) * 100) : 0;
		var space = freePercent + '% (' + freeMB + ' MB free / ' + sizeMB + ' MB total)';

		var capacityBar = E('div', { 
			'class': 'cbi-progressbar', 
			'title': space,
			'style': 'height: 20px; position: relative; border-radius: 3px; margin-bottom: 5px; background-color: #f5f5f5; border: 1px solid #ddd;'
		}, [
			E('div', { 
				'style': 'position: absolute; left: 0; right: 0; height: 100%; background-color: #3bb4d8; border-radius: 3px;'
			}),
			E('div', {
				'style': 'position: absolute; left: 0; right: 0; top: 0; bottom: 0; text-align: center; line-height: 32px; color: black; font-weight: bold; padding: 0 5px; font-size: calc(32px * 0.9);'
			}, [ space ])
		]);

		// Package list processing
		var rows = [];
		var lines = installed.split('\n');
		var allPackages = [];
		
		// Add debugging information
		var debugInfo = 'Package data length: ' + installed.length + ' bytes, Line count: ' + lines.length;
		
		// Parse package information
		var currentPkg = null;
		
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			if (!line) continue;
			
			// Parse Status file format
			if (line.match(/^Package:\s*(.*)/)) {
				if (currentPkg) {
					allPackages.push(currentPkg);
				}
				currentPkg = {
					name: RegExp.$1,
					version: '',
					description: ''
				};
			}
			else if (currentPkg && line.match(/^Version:\s*(.*)/)) {
				currentPkg.version = RegExp.$1;
			}
			else if (currentPkg && line.match(/^Description:\s*(.*)/)) {
				currentPkg.description = RegExp.$1;
			}
			else if (currentPkg && line.match(/^Status:\s*(.*)/)) {
				currentPkg.status = RegExp.$1;
			}
		}
		
		// Add the last package
		if (currentPkg) {
			allPackages.push(currentPkg);
		}
		
		// Filter installed packages only
		allPackages = allPackages.filter(function(pkg) {
			return pkg.status && pkg.status.indexOf('installed') >= 0;
		});
		
		// Filter nginx, ssh, ssl related packages
		var nginxPackages = [];
		var sslPackages = [];
		var sshPackages = [];
		
		for (var i = 0; i < allPackages.length; i++) {
			var pkg = allPackages[i];
			
			if (pkg.name.match(/nginx/i)) {
				nginxPackages.push(pkg);
			}
			else if (pkg.name.match(/ssl/i)) {
				sslPackages.push(pkg);
			}
			else if (pkg.name.match(/ssh/i)) {
				sshPackages.push(pkg);
			}
		}
		
		// Sort each category alphabetically
		nginxPackages.sort(function(a, b) { return a.name.localeCompare(b.name); });
		sslPackages.sort(function(a, b) { return a.name.localeCompare(b.name); });
		sshPackages.sort(function(a, b) { return a.name.localeCompare(b.name); });
		
		// Combine all packages in the specified order
		var sortedPackages = [].concat(nginxPackages, sslPackages, sshPackages);
		
		// Create rows for the sorted packages
		for (var i = 0; i < sortedPackages.length; i++) {
			var pkg = sortedPackages[i];
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ pkg.name ]),
				E('td', { 'class': 'td version' }, [ pkg.version ])
			]));
		}
		
		// If no filtered packages, show first 10 packages
		if (sortedPackages.length === 0 && allPackages.length > 0) {
			debugInfo += ', No filtered packages, showing first 10 packages';
			
			for (var i = 0; i < Math.min(10, allPackages.length); i++) {
				var pkg = allPackages[i];
				rows.push(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, [ pkg.name ]),
					E('td', { 'class': 'td version' }, [ pkg.version ])
				]));
			}
		}
		
		// Create basic table structure
		var packageTable = E('table', { 'id': 'packages', 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Package Name') ]),
				E('th', { 'class': 'th' }, [ _('Version') ])
			])
		]);
		
		// Add package rows
		if (rows.length > 0) {
			for (var i = 0; i < rows.length; i++) {
				packageTable.appendChild(rows[i]);
			}
		} else {
			packageTable.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'colspan': '2' }, [ 'No matching packages found.' ])
			]));
		}

		// Create final view
		var view = E([], [
			E('style', { 'type': 'text/css' }, [ css ]),
			E('div', { 'class': 'cbi-map' }, [
				E('h2', { 'name': 'content' }, [ _('Software') ]),
				E('div', { 'class': 'cbi-section' }, [
					E('p', {}, [ _('Free Space:') ]),
					E('div', { 'style': 'position: relative; height: 32px; margin-bottom: 10px;' }, [
						E('div', { 
							'style': 'position: absolute; left: 0; right: 0; height: 100%; background-color: #3bb4d8; border-radius: 3px;'
						}),
						E('div', {
							'style': 'position: absolute; left: 0; right: 0; top: 0; bottom: 0; text-align: center; line-height: 32px; color: black; font-weight: bold; padding: 0 5px; font-size: calc(32px * 0.9);'
						}, [ space ])
					]),
					packageTable
				])
			])
		]);

		return view;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
