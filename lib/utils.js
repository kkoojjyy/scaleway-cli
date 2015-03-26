var Api = require('onlinelabs'),
    Datastore = require('nedb'),
    Table = require('cli-table'),
    _ = require('lodash'),
    child_process = require('child_process'),
    debug = require('debug')('onlinelabs-cli:utils');


module.exports.db = new Datastore({ filename: '/tmp/onlinelabs.db', autoload: true });


module.exports.saveEntities = function(entities, category) {
  module.exports.db.remove(
    { _type: category },
    { multi: true },
    function(err, numRemoved) {
      debug('saveEntities: removed ' + numRemoved + ' items');
      if (err) {
        module.exports.panic(err);
      }
      module.exports.db.insert(_.map(entities, function(entity) {
        entity._id = entity.id;
        entity._type = category;
        return entity;
      }), function(err, newDocs) {
        debug('saveEntities: inserted ' + newDocs.length + ' items');
        if (err) {
          module.exports.panic(err);
        }
      });
    });
};


module.exports.searchEntity = function(search, filters, cb) {
  filters = filters || {};
  filters._id = new RegExp('^' + search);
  module.exports.db.find(filters, function(err, rows) {
    if (rows.length === 1) {
      debug('searchEntity '+ search +', found 1 row: ' + rows[0]._id);
      cb(null, rows[0]._id);
    } else {
      debug('searchEntity '+ search +', no such row');
      cb(null, search);
    }
  });
};


module.exports.panic = function(msg) {
  if (msg && msg.options && msg.options.method && msg.options.url &&
      msg.statusCode && msg.error && msg.error.message) {
    debug('panic', msg);
    console.error('> ' + msg.options.method + ' ' + msg.options.url);
    console.error('< ' + msg.error.message + ' (' + msg.statusCode + ')');
  } else {
    console.error(msg);
  }
  process.exit(-1);
};


module.exports.notImplementedAction = function() {
  console.error("onlinelabs: Not implemented");
};


module.exports.truncateRow = function(row, limits) {
  for (var idx in row) {
    if (limits[idx] !== -1) {
      row[idx] = row[idx].toString().substring(0, limits[idx]);
    }
  }
  return row;
};


module.exports.defaultConfigPath = function() {
  var home = process.env[(
    process.platform === 'win32' ?
      'USERPROFILE' :
      'HOME'
  )];
  return home + '/.onlinelabsrc';
};


module.exports.newTable = function(options) {
  options = options || {};
  options.chars = options.chars || {
    'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
    'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
    'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
    'right': '', 'right-mid': '', 'middle': ' '
  };
  options.style = options.style || {
    // 'padding-left': 0, 'padding-right': 0
  };
  return new Table(options);
};


module.exports.wordify = function(str) {
  return str
    .replace(/[^a-zA-Z0-9-]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_/, '')
    .replace(/_$/, '');
};


module.exports.newApi = function(options) {
  var overrides = {};
  if (options && options.parent && options.parent.apiEndpoint) {
    overrides.api_endpoint = options.parent.apiEndpoint;
  }
  var config = module.exports.rc(overrides);
  return new Api(config);
};


module.exports.collect = function(val, memo) {
  memo.push(val);
  return memo;
};


module.exports.rc = function() {
  return require('onlinelabs/node_modules/rc')('onlinelabs', {
    api_endpoint: 'https://api.cloud.online.net/',
    organization: null,
    token: null
  });
};


module.exports.getVersion = function(module) {
  return require(module + '/package.json').version;
};


module.exports.anonymizeUUID = function(uuid) {
  return uuid.replace(/^(.{4})(.{4})-(.{4})-(.{4})-(.{4})-(.{8})(.{4})$/, '$1-xxxx-$4-xxxx-xxxxxxxx$7');
};


module.exports.escapeShell = function(command) {
  if (typeof(command) !== 'string') {
    command = command.join(' ');
  }
  return '\'' + command.replace(/\'/g, "'\\''") + '\'';
};


module.exports.sshExec = function(ip, command, options, fn) {
  options = options || {};

  var args = ['-l', 'root', ip, '/bin/sh', '-e'];

  if (options.verbose) {
    args.push('-x');
  }

  args.push('-c');
  args.push(module.exports.escapeShell(command));

  debug('spawn: ssh ' + args.join(' '));
  var spawn = child_process.spawn(
    'ssh',
    args,
    { stdio: 'inherit' }
  );
  if (fn) {
    spawn.on('close', function(code) {
      return fn(code);
    });
  }
  return spawn;
};