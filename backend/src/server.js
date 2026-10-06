const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const multer = require('multer');
const { execFile } = require('child_process');

require('dotenv').config({
  path: path.join(__dirname, '../.env')
});

const app = express();

const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'virtual-lab-demo-secret';

const DB = path.join(__dirname, '../data/db.json');
const UP = path.join(__dirname, '../data/uploads');

fs.mkdirSync(UP, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(UP));
app.use(express.static(path.join(__dirname, '../../frontend')));


// ==================== DATABASE ====================

function read() {
  return JSON.parse(fs.readFileSync(DB, 'utf8'));
}

function write(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}


// ==================== AUTH ====================

function seed() {
  let data = read();

  if (data.users.length) {
    return;
  }

  const now = new Date().toISOString();

  data.users = [
    {
      id: uuid(),
      name: 'Demo Student',
      email: 'student@vlab.com',
      password: bcrypt.hashSync('Student@123', 10),
      role: 'student',
      createdAt: now
    },
    {
      id: uuid(),
      name: 'Demo Faculty',
      email: 'faculty@vlab.com',
      password: bcrypt.hashSync('Faculty@123', 10),
      role: 'faculty',
      createdAt: now
    }
  ];

  data.labs = [
    {
      id: uuid(),
      name: 'Python Programming Lab',
      description:
        'Python 3 programming environment for experiments and assignments.',
      image: 'python',
      capacity: 30,
      active: true,
      createdAt: now
    },
    {
      id: uuid(),
      name: 'Linux Administration Lab',
      description:
        'Linux command-line and operating-system practice environment.',
      image: 'linux',
      capacity: 25,
      active: true,
      createdAt: now
    },
    {
      id: uuid(),
      name: 'Database Lab',
      description:
        'SQL and database fundamentals practice environment.',
      image: 'database',
      capacity: 25,
      active: true,
      createdAt: now
    }
  ];

  write(data);
}

seed();


function auth(req, res, next) {
  const header = req.headers.authorization || '';

  try {
    const token = header.startsWith('Bearer ')
      ? header.slice(7)
      : null;

    if (!token) {
      throw new Error();
    }

    req.user = jwt.verify(token, SECRET);

    next();
  } catch (error) {
    res.status(401).json({
      message: 'Authentication required'
    });
  }
}


function role(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({
        message: 'Access denied'
      });
    }
  };
}


// ==================== FILE UPLOAD ====================

const upload = multer({
  dest: UP,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});


// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {

  const {
    name,
    email,
    password,
    role: userRole = 'student'
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: 'Name, email and password are required'
    });
  }

  const data = read();

  if (
    data.users.some(
      user => user.email.toLowerCase() === email.toLowerCase()
    )
  ) {
    return res.status(409).json({
      message: 'Email already registered'
    });
  }

  const user = {
    id: uuid(),
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role: userRole === 'faculty' ? 'faculty' : 'student',
    createdAt: new Date().toISOString()
  };

  data.users.push(user);

  write(data);

  res.status(201).json({
    message: 'Registered successfully'
  });
});


app.post('/api/auth/login', async (req, res) => {

  const {
    email,
    password
  } = req.body;

  const data = read();

  const user = data.users.find(
    u => u.email.toLowerCase() === String(email).toLowerCase()
  );

  if (
    !user ||
    !(await bcrypt.compare(password, user.password))
  ) {
    return res.status(401).json({
      message: 'Invalid email or password'
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    SECRET,
    {
      expiresIn: '8h'
    }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});


app.get('/api/me', auth, (req, res) => {
  res.json(req.user);
});


// ==================== LAB ROUTES ====================

app.get('/api/labs', auth, (req, res) => {

  const data = read();

  res.json(data.labs);
});


app.post('/api/labs', auth, role('faculty'), (req, res) => {

  const {
    name,
    description,
    capacity = 30,
    image = 'lab'
  } = req.body;

  if (!name) {
    return res.status(400).json({
      message: 'Lab name required'
    });
  }

  const data = read();

  const lab = {
    id: uuid(),
    name,
    description: description || '',
    capacity: Number(capacity),
    image,
    active: true,
    createdAt: new Date().toISOString()
  };

  data.labs.push(lab);

  write(data);

  res.status(201).json(lab);
});


app.patch('/api/labs/:id', auth, role('faculty'), (req, res) => {

  const data = read();

  const lab = data.labs.find(
    x => x.id === req.params.id
  );

  if (!lab) {
    return res.status(404).json({
      message: 'Lab not found'
    });
  }

  Object.assign(lab, req.body);

  write(data);

  res.json(lab);
});


// ==================== DOCKER ====================

function dockerAvailable(callback) {

  execFile(
    'docker',
    [
      'version',
      '--format',
      '{{.Server.Version}}'
    ],
    {
      timeout: 5000
    },
    (error, stdout, stderr) => {

      console.log(
        'Docker check:',
        error ? error.message : stdout.trim()
      );

      callback(
        !error &&
        stdout.trim().length > 0
      );
    }
  );
}


function dockerCreate(lab, student, callback) {

  const containerName =
    'vlab_' +
    student.id.slice(0, 8) +
    '_' +
    lab.id.slice(0, 8);

  const volumeName =
    'vlab_' +
    student.id.slice(0, 8) +
    '_storage';

  let image;

  if (lab.image === 'python') {
    image = 'python:3.12-alpine';
  } else if (lab.image === 'linux') {
    image = 'alpine:3.20';
  } else {
    image = 'postgres:16-alpine';
  }

  console.log('Creating Docker VM...');
  console.log('Container:', containerName);
  console.log('Volume:', volumeName);
  console.log('Image:', image);

  execFile(
    'docker',
    [
      'run',
      '-d',
      '--name',
      containerName,
      '-v',
      `${volumeName}:/home/student/workspace`,
      image,
      'sh',
      '-c',
      'while true; do sleep 3600; done'
    ],
    {
      timeout: 15000
    },
    (error, stdout, stderr) => {

      if (error) {

        console.log(
          'Docker creation failed:',
          error.message
        );

        console.log(
          'Docker stderr:',
          stderr
        );

        callback(null);
        return;
      }

      console.log(
        'Docker container created:',
        stdout.trim()
      );

      callback({
        containerId: stdout.trim(),
        containerName,
        image
      });
    }
  );
}


// ==================== VM ROUTES ====================

app.get('/api/vms', auth, (req, res) => {

  const data = read();

  const vms = data.vms.filter(
    vm =>
      req.user.role === 'faculty' ||
      vm.studentId === req.user.id
  );

  res.json(
    vms.map(vm => ({
      ...vm,

      student:
        data.users.find(
          user => user.id === vm.studentId
        )?.name || 'Unknown',

      lab:
        data.labs.find(
          lab => lab.id === vm.labId
        )?.name || 'Unknown'
    }))
  );
});


// ==================== LAUNCH VM ====================

app.post(
  '/api/vms/launch/:labId',
  auth,
  role('student'),
  (req, res) => {

    const data = read();

    const lab = data.labs.find(
      x => x.id === req.params.labId
    );

    if (!lab) {
      return res.status(404).json({
        message: 'Lab not found'
      });
    }

    /*
      If a VM is already running,
      return the existing VM.
    */

    const runningVm = data.vms.find(
      vm =>
        vm.studentId === req.user.id &&
        vm.labId === lab.id &&
        vm.status === 'RUNNING'
    );

    if (runningVm) {
      return res.json(runningVm);
    }


    /*
      Find an existing STOPPED VM.

      We reuse the newest stopped VM instead
      of creating another VM record.
    */

    const stoppedVms = data.vms
      .filter(
        vm =>
          vm.studentId === req.user.id &&
          vm.labId === lab.id &&
          vm.status === 'STOPPED'
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );

    let vm = stoppedVms[0];


    /*
      If a stopped VM exists,
      reuse its ID.
    */

    if (vm) {

      vm.status = 'PROVISIONING';

      vm.mode = 'simulation';

      vm.containerId = null;

      delete vm.containerName;
      delete vm.image;
      delete vm.stoppedAt;

    } else {

      /*
        No previous VM exists.
        Create a new VM record.
      */

      vm = {
        id: uuid(),
        studentId: req.user.id,
        labId: lab.id,
        status: 'PROVISIONING',
        mode: 'simulation',
        containerId: null,
        createdAt: new Date().toISOString()
      };

      data.vms.push(vm);
    }

    write(data);


    /*
      Called after Docker/simulation VM
      provisioning is completed.
    */

    const finish = info => {

      const updatedData = read();

      const currentVm = updatedData.vms.find(
        v => v.id === vm.id
      );

      if (!currentVm) {
        return;
      }

      currentVm.status = 'RUNNING';

      if (info) {

        currentVm.mode = 'docker';

        currentVm.containerId =
          info.containerId;

        currentVm.containerName =
          info.containerName;

        currentVm.image =
          info.image;

      } else {

        currentVm.mode = 'simulation';

        currentVm.containerId =
          'sim-' + vm.id.slice(0, 8);

        currentVm.containerName =
          'virtual-lab-' + vm.id.slice(0, 8);
      }

      write(updatedData);

      res.status(201).json(currentVm);
    };


    /*
      Try Docker if USE_DOCKER=true.
    */

    if (
      String(process.env.USE_DOCKER).toLowerCase() ===
      'true'
    ) {

      dockerAvailable(ok => {

        if (ok) {

          dockerCreate(
            lab,
            req.user,
            finish
          );

        } else {

          finish(null);

        }

      });

    } else {

      finish(null);

    }
  }
);


// ==================== STOP VM ====================

app.post('/api/vms/:id/stop', auth, (req, res) => {

  const data = read();

  const vm = data.vms.find(
    x => x.id === req.params.id
  );

  if (
    !vm ||
    (
      vm.studentId !== req.user.id &&
      req.user.role !== 'faculty'
    )
  ) {
    return res.status(404).json({
      message: 'VM not found'
    });
  }


  /*
    IMPORTANT:

    docker rm -f removes the container.

    It DOES NOT remove the named Docker volume.

    Therefore files inside:

    /home/student/workspace

    remain persistent.

    We also wait until Docker removal finishes
    before sending the response.
  */

  const markStopped = () => {

    vm.status = 'STOPPED';

    vm.stoppedAt =
      new Date().toISOString();

    write(data);

    res.json(vm);
  };


  if (
    vm.mode === 'docker' &&
    vm.containerName
  ) {

    execFile(
      'docker',
      [
        'rm',
        '-f',
        vm.containerName
      ],
      (error, stdout, stderr) => {

        if (error) {

          console.log(
            'Docker stop/remove failed:',
            error.message
          );

          console.log(
            'Docker stderr:',
            stderr
          );

        } else {

          console.log(
            'Docker container removed:',
            vm.containerName
          );

        }

        markStopped();
      }
    );

  } else {

    markStopped();

  }
});


// ==================== DELETE VM ====================

app.delete('/api/vms/:id', auth, (req, res) => {

  const data = read();

  const index = data.vms.findIndex(
    x => x.id === req.params.id
  );

  if (index < 0) {
    return res.status(404).json({
      message: 'VM not found'
    });
  }

  const vm = data.vms[index];

  if (
    vm.studentId !== req.user.id &&
    req.user.role !== 'faculty'
  ) {
    return res.status(403).json({
      message: 'Access denied'
    });
  }

  if (
    vm.mode === 'docker' &&
    vm.containerName
  ) {

    execFile(
      'docker',
      [
        'rm',
        '-f',
        vm.containerName
      ],
      () => {}
    );
  }

  data.vms.splice(index, 1);

  write(data);

  res.json({
    message: 'VM deleted'
  });
});


// ==================== TERMINAL ====================

app.post(
  '/api/vms/:id/command',
  auth,
  async (req, res) => {

    const data = read();

    const vm = data.vms.find(
      x => x.id === req.params.id
    );

    if (
      !vm ||
      vm.studentId !== req.user.id ||
      vm.status !== 'RUNNING'
    ) {
      return res.status(404).json({
        message: 'Running VM not found'
      });
    }

    const command =
      String(req.body.command || '').trim();

    if (!command) {
      return res.json({
        output: ''
      });
    }

    const forbidden =
      /[;&|`$<\\]|\b(rm|curl|wget|shutdown|reboot|mkfs|dd)\b/i;

    if (forbidden.test(command)) {
      return res.status(400).json({
        message:
          'Command blocked by demo security policy'
      });
    }


    if (
      vm.mode === 'docker' &&
      vm.containerName
    ) {

      execFile(
        'docker',
        [
          'exec',
          vm.containerName,
          'sh',
          '-lc',
          command
        ],
        {
          timeout: 5000
        },
        (error, stdout, stderr) => {

          res.json({
            output:
              (
                stdout ||
                stderr ||
                error?.message ||
                ''
              ).slice(0, 4000)
          });

        }
      );

    } else {

      const canned = {

        pwd:
          '/home/student',

        ls:
          'lab.py\nREADME.md\nworkspace/',

        whoami:
          'student',

        'python --version':
          'Python 3.12.0',

        'python3 --version':
          'Python 3.12.0',

        'echo hello':
          'hello',

        date:
          new Date().toString()
      };

      res.json({
        output:
          canned[command] ??
          `$ ${command}\n[Simulation] Command accepted. In Docker mode this runs inside the isolated lab container.`
      });
    }
  }
);


// ==================== STORAGE ====================

app.get('/api/storage', auth, (req, res) => {

  const data = read();

  const files = data.files.filter(
    file => file.userId === req.user.id
  );

  const used = files.reduce(
    (total, file) => total + file.size,
    0
  );

  res.json({
    quota: 5 * 1024 * 1024 * 1024,
    used,
    files
  });
});


app.post(
  '/api/storage/upload',
  auth,
  upload.single('file'),
  (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        message: 'File required'
      });
    }

    const data = read();

    const used =
      data.files
        .filter(
          file => file.userId === req.user.id
        )
        .reduce(
          (total, file) => total + file.size,
          0
        );

    if (
      used + req.file.size >
      5 * 1024 * 1024 * 1024
    ) {

      fs.unlinkSync(req.file.path);

      return res.status(400).json({
        message: 'Storage quota exceeded'
      });
    }

    const file = {
      id: uuid(),
      userId: req.user.id,
      name: req.file.originalname,
      size: req.file.size,
      path: req.file.filename,
      uploadedAt: new Date().toISOString()
    };

    data.files.push(file);

    write(data);

    res.status(201).json(file);
  }
);


app.delete('/api/storage/:id', auth, (req, res) => {

  const data = read();

  const index = data.files.findIndex(
    file =>
      file.id === req.params.id &&
      file.userId === req.user.id
  );

  if (index < 0) {
    return res.status(404).json({
      message: 'File not found'
    });
  }

  const file = data.files[index];

  try {
    fs.unlinkSync(
      path.join(UP, file.path)
    );
  } catch (error) {}

  data.files.splice(index, 1);

  write(data);

  res.json({
    message: 'Deleted'
  });
});


// ==================== ADMIN ====================

app.get(
  '/api/admin/stats',
  auth,
  role('faculty'),
  (req, res) => {

    const data = read();

    res.json({

      students:
        data.users.filter(
          user => user.role === 'student'
        ).length,

      faculty:
        data.users.filter(
          user => user.role === 'faculty'
        ).length,

      labs:
        data.labs.length,

      runningVMs:
        data.vms.filter(
          vm => vm.status === 'RUNNING'
        ).length,

      totalVMs:
        data.vms.length,

      storage:
        data.files.reduce(
          (total, file) => total + file.size,
          0
        )
    });
  }
);


app.get(
  '/api/admin/users',
  auth,
  role('faculty'),
  (req, res) => {

    const data = read();

    res.json(
      data.users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }))
    );
  }
);


// ==================== FRONTEND ====================

app.get('*', (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      '../../frontend/index.html'
    )
  );

});


// ==================== START SERVER ====================

app.listen(
  PORT,
  () => {
    console.log(
      `Virtual Lab running at http://localhost:${PORT}`
    );
  }
);