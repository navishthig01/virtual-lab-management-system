# Project Documentation

## Problem Statement
Educational institutions need scalable virtual laboratory environments that students and faculty can access remotely. Manual provisioning of lab machines can be slow and resource intensive. This prototype provides a centralized web system for lab discovery, on-demand environment provisioning, storage management and controlled remote access.

## Objectives
1. Provide role-based access for students and faculty.
2. Provision isolated lab environments on demand.
3. Track VM/container status and lifecycle.
4. Provide a personal storage quota for lab files.
5. Demonstrate secure browser-based remote access.
6. Provide a foundation that can be deployed on cloud infrastructure.

## Architecture
React-style browser UI -> Express REST API -> JSON persistence -> VM/container provisioning -> storage subsystem.
For a production deployment, JSON persistence can be replaced by MongoDB/PostgreSQL and simulated provisioning can be connected to AWS EC2, OpenStack or Kubernetes.

## Core Modules
- Authentication and authorization
- Lab management
- VM lifecycle management
- Remote terminal
- Storage management
- Faculty monitoring

## Demo Flow
1. Login as student.
2. Open Labs.
3. Launch Python Lab.
4. Open My Virtual Machines.
5. Open Lab and run `python --version`, `pwd`, `ls`.
6. Upload a file in Storage.
7. Stop the environment.
8. Login as faculty and inspect dashboard, VMs and users.

## Limitations of Prototype
- Local JSON persistence is used for portability.
- Docker mode is optional; without Docker the provisioning lifecycle is simulated.
- Browser terminal is intentionally restricted in simulation mode.
- Production systems require HTTPS, managed secrets, stronger isolation, network policies, audit logs and cloud resource controls.
