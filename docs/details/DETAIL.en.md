# OpenViking Manager

OpenViking Manager is a DSH configuration UI for [OpenViking](https://docs.openviking.ai/en/agent-integrations/17-dsh). It manages the local client connection, user keys, and memory settings. Memory sync, commit, and recall remain the job of the official plugin [`@openviking/dsh-memory-plugin`](https://www.npmjs.com/package/@openviking/dsh-memory-plugin).

## Features

- **Connection**: reads, imports, and updates `~/.openviking/ovcli.conf`, and verifies service reachability and user identity. An existing `user_key` is only shown masked.
- **Diagnostics**: checks the format and file permissions of `ovcli.conf` with a one-click permission repair, and reads non-sensitive state from the local `ov.conf`, such as the auth mode.
- **Recovery and initialization**: uses a temporary root key with the official Admin API to list accounts and users, create accounts or users, and regenerate user keys. The root key is never written to a file.
- **Per-session memory toggle**: the "OpenViking" pill in the input box turns memory reads and writes off for one session. The pill is hidden by default; turn it on from the "Composer pill" card on the configuration page.
- **Project memory isolation**: recall is limited to the current project by default. Projects are told apart by git repository, so one project shares memory across agents and machines while different projects stay isolated.
- **Project panel**: shows the project peer of a directory, the effective recall scope and where it comes from, and isolation risks from workspace config in the repository.
- **Recall tuning**: adjusts the recall score threshold, injection limit, query expansion, excluded URIs, event decay protection, and timeouts. Saving reloads the official plugin automatically.
- **Languages**: follows the DSH language setting, in English and Simplified Chinese.

## Repository

Source, installation, and full documentation on GitHub: <https://github.com/xbzbing/dsh-openviking-manager>
