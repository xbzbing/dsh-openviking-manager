# dsh-openviking-manager

A DSH UI plugin for managing an existing OpenViking connection. It owns local client configuration in `~/.openviking/ovcli.conf`; it does not replace the official `@openviking/dsh-memory-plugin` memory pipeline.

## First slice

- import and safely display `ovcli.conf` fields;
- preserve a masked existing user key unless a new one is supplied;
- validate an OpenViking HTTP endpoint before saving;
- provide a DSH Plugins-page UI and same-origin manager API.

Future slices add server health/identity checks, local `ov.conf` discovery, temporary root-key user management, Studio, and the non-sensitive multi-device update checklist.
