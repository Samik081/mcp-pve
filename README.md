[![npm version](https://img.shields.io/npm/v/@samik081/mcp-pve)](https://www.npmjs.com/package/@samik081/mcp-pve)
[![License: MIT](https://img.shields.io/npm/l/@samik081/mcp-pve)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@samik081/mcp-pve)](https://nodejs.org)

# MCP PVE

MCP server for [Proxmox VE](https://www.proxmox.com/en/proxmox-virtual-environment/overview). Manage virtual machines, containers, storage, networking, and clusters through natural language in Cursor, Claude Code, and Claude Desktop.

> **Disclaimer:** Most of this code has been AI-generated and has not been fully tested yet. I created this project for my own needs and plan to continue improving its quality, but it may be buggy in the early stages. If you find a bug, feel free to [open an issue](https://github.com/Samik081/mcp-pve/issues) -- I'll try to work on it in my spare time.

## Features

- **105 tools** across **12 categories** covering the Proxmox VE REST API
- **Three access tiers** (`read-only`, `read-execute`, `full`) for granular control
- **Category filtering** via `PVE_CATEGORIES` to expose only the tools you need
- **Zero HTTP dependencies** -- uses native `fetch` (Node 18+)
- **Self-signed cert support** via `PVE_VERIFY_SSL=false`
- **TypeScript/ESM** with full type safety

## Quick Start

Run the server directly with npx:

```bash
PVE_BASE_URL="https://pve.example.com:8006" \
PVE_TOKEN_ID="root@pam!mcp" \
PVE_TOKEN_SECRET="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
npx -y @samik081/mcp-pve
```

The server validates your PVE connection on startup and fails immediately with a clear error if credentials are missing or invalid.

## Configuration

**Claude Code CLI (recommended):**

```bash
claude mcp add --transport stdio pve \
  --env PVE_BASE_URL=https://pve.example.com:8006 \
  --env PVE_TOKEN_ID=root@pam!mcp \
  --env PVE_TOKEN_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --env PVE_VERIFY_SSL=false \
  -- npx -y @samik081/mcp-pve
```

**JSON config** (works with Claude Code `.mcp.json`, Claude Desktop `claude_desktop_config.json`, Cursor `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "pve": {
      "command": "npx",
      "args": ["-y", "@samik081/mcp-pve"],
      "env": {
        "PVE_BASE_URL": "https://pve.example.com:8006",
        "PVE_TOKEN_ID": "root@pam!mcp",
        "PVE_TOKEN_SECRET": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "PVE_VERIFY_SSL": "false"
      }
    }
  }
}
```

## Access Tiers

Control which tools are available using the `PVE_ACCESS_TIER` environment variable:

| Tier | Tools | Description |
|------|-------|-------------|
| `full` (default) | 105 | Read, execute, and write -- full control |
| `read-execute` | 68 | Read and execute -- no resource creation/deletion |
| `read-only` | 51 | Read only -- safe for exploration, no state changes |

**Tier details:**

- **full**: All 105 tools. Includes creating/deleting VMs, containers, storage, users, firewall rules, and more.
- **read-execute**: 68 tools. All read tools plus power actions (start, stop, migrate), backup execution, and task management.
- **read-only**: 51 tools. List, get, status, and log tools only. No state changes.

Tools that are not available in your tier are not registered with the MCP server. They will not appear in your AI tool's tool list, keeping the context clean.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PVE_BASE_URL` | Yes | — | URL of your PVE instance (e.g. `https://pve:8006`) |
| `PVE_TOKEN_ID` | Yes | — | API token ID (`user@realm!tokenname`) |
| `PVE_TOKEN_SECRET` | Yes | — | API token UUID secret |
| `PVE_ACCESS_TIER` | No | `full` | `read-only`, `read-execute`, or `full` |
| `PVE_CATEGORIES` | No | all | Comma-separated category allowlist |
| `PVE_VERIFY_SSL` | No | `true` | Set `false` for self-signed certs |
| `DEBUG` | No | — | Set to any value to enable debug logging to stderr |

Create API tokens in the PVE UI under **Datacenter > Permissions > API Tokens**. Make sure to uncheck "Privilege Separation" if you want the token to inherit the user's full permissions.

### Available Categories

`nodes`, `qemu`, `lxc`, `storage`, `cluster`, `access`, `pools`, `network`, `firewall`, `backup`, `tasks`, `ha`

## Tools

mcp-pve provides 105 tools organized by category. Each tool's Access column shows the minimum tier required: `read-only` (available in all tiers), `read-execute` (requires `read-execute` or `full`), or `full` (requires `full` tier only).

<details>
<summary>Nodes (8 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_list_nodes` | List all nodes in the cluster | read-only |
| `pve_get_node_status` | Get detailed node status (CPU, memory, uptime, load) | read-only |
| `pve_get_node_version` | Get PVE version info for a node | read-only |
| `pve_get_node_dns` | Get DNS settings for a node | read-only |
| `pve_get_node_time` | Get time and timezone info for a node | read-only |
| `pve_get_node_syslog` | Get system log entries from a node | read-only |
| `pve_list_node_services` | List all system services on a node | read-only |
| `pve_manage_node_service` | Start, stop, restart, or reload a node service | read-execute |

</details>

<details>
<summary>QEMU Virtual Machines (20 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_list_qemu_vms` | List all QEMU VMs on a node | read-only |
| `pve_get_qemu_status` | Get current VM status (CPU, memory, disk, network) | read-only |
| `pve_get_qemu_config` | Get VM configuration | read-only |
| `pve_get_qemu_rrddata` | Get RRD statistics over a time period | read-only |
| `pve_list_qemu_snapshots` | List all VM snapshots | read-only |
| `pve_start_qemu_vm` | Start a VM | read-execute |
| `pve_stop_qemu_vm` | Stop a VM (immediate) | read-execute |
| `pve_shutdown_qemu_vm` | Gracefully shut down a VM | read-execute |
| `pve_reboot_qemu_vm` | Reboot a VM | read-execute |
| `pve_suspend_qemu_vm` | Suspend a VM | read-execute |
| `pve_resume_qemu_vm` | Resume a suspended VM | read-execute |
| `pve_reset_qemu_vm` | Reset a VM (hard) | read-execute |
| `pve_migrate_qemu_vm` | Migrate a VM to another node | read-execute |
| `pve_create_qemu_vm` | Create a new VM | full |
| `pve_delete_qemu_vm` | Delete a VM and all its data | full |
| `pve_update_qemu_config` | Update VM configuration | full |
| `pve_clone_qemu_vm` | Clone a VM | full |
| `pve_create_qemu_snapshot` | Create a VM snapshot | full |
| `pve_delete_qemu_snapshot` | Delete a VM snapshot | full |
| `pve_rollback_qemu_snapshot` | Rollback a VM to a snapshot | full |

</details>

<details>
<summary>LXC Containers (18 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_list_lxc_containers` | List all LXC containers on a node | read-only |
| `pve_get_lxc_status` | Get current container status | read-only |
| `pve_get_lxc_config` | Get container configuration | read-only |
| `pve_get_lxc_rrddata` | Get RRD statistics over a time period | read-only |
| `pve_list_lxc_snapshots` | List all container snapshots | read-only |
| `pve_start_lxc_container` | Start a container | read-execute |
| `pve_stop_lxc_container` | Stop a container (immediate) | read-execute |
| `pve_shutdown_lxc_container` | Gracefully shut down a container | read-execute |
| `pve_reboot_lxc_container` | Reboot a container | read-execute |
| `pve_suspend_lxc_container` | Suspend (freeze) a container | read-execute |
| `pve_resume_lxc_container` | Resume (unfreeze) a container | read-execute |
| `pve_create_lxc_container` | Create a new container | full |
| `pve_delete_lxc_container` | Delete a container and all its data | full |
| `pve_update_lxc_config` | Update container configuration | full |
| `pve_clone_lxc_container` | Clone a container | full |
| `pve_create_lxc_snapshot` | Create a container snapshot | full |
| `pve_delete_lxc_snapshot` | Delete a container snapshot | full |
| `pve_rollback_lxc_snapshot` | Rollback a container to a snapshot | full |

</details>

<details>
<summary>Storage (8 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_list_storage` | List all configured storage backends | read-only |
| `pve_get_storage_config` | Get storage backend configuration | read-only |
| `pve_list_node_storage` | List available storage on a node with usage info | read-only |
| `pve_get_storage_status` | Get storage status and usage on a node | read-only |
| `pve_list_storage_content` | List storage content (images, ISOs, backups) | read-only |
| `pve_create_storage` | Create a new storage backend | full |
| `pve_update_storage` | Update storage configuration | full |
| `pve_delete_storage` | Delete a storage backend | full |

</details>

<details>
<summary>Cluster (9 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_get_cluster_status` | Get cluster status (membership, quorum) | read-only |
| `pve_list_cluster_resources` | List all cluster resources with optional type filter | read-only |
| `pve_get_next_vmid` | Get the next available VMID | read-only |
| `pve_get_cluster_log` | Get recent cluster log entries | read-only |
| `pve_get_cluster_options` | Get datacenter options | read-only |
| `pve_list_cluster_backup_info` | List guests not covered by backup jobs | read-only |
| `pve_get_cluster_ha_status` | Get HA manager status | read-only |
| `pve_list_cluster_replication` | List all replication jobs | read-only |
| `pve_update_cluster_options` | Update datacenter options | full |

</details>

<details>
<summary>Access Control (10 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_list_users` | List all users | read-only |
| `pve_get_user` | Get user details | read-only |
| `pve_list_roles` | List all roles and privileges | read-only |
| `pve_list_groups` | List all user groups | read-only |
| `pve_list_acls` | List all ACL entries | read-only |
| `pve_list_domains` | List authentication domains/realms | read-only |
| `pve_create_user` | Create a new user | full |
| `pve_update_user` | Update user properties | full |
| `pve_delete_user` | Delete a user | full |
| `pve_update_acl` | Grant or revoke ACL permissions | full |

</details>

<details>
<summary>Pools (5 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_list_pools` | List all resource pools | read-only |
| `pve_get_pool` | Get pool details and members | read-only |
| `pve_create_pool` | Create a resource pool | full |
| `pve_update_pool` | Update pool members and settings | full |
| `pve_delete_pool` | Delete a resource pool | full |

</details>

<details>
<summary>Network (5 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_list_networks` | List all network interfaces on a node | read-only |
| `pve_get_network` | Get network interface configuration | read-only |
| `pve_create_network` | Create a network interface | full |
| `pve_update_network` | Update network interface configuration | full |
| `pve_delete_network` | Delete a network interface | full |

</details>

<details>
<summary>Firewall (8 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_get_firewall_options` | Get cluster firewall options | read-only |
| `pve_list_firewall_rules` | List cluster firewall rules | read-only |
| `pve_list_firewall_aliases` | List firewall aliases | read-only |
| `pve_list_firewall_ipsets` | List firewall IP sets | read-only |
| `pve_update_firewall_options` | Update cluster firewall options | full |
| `pve_create_firewall_rule` | Create a firewall rule | full |
| `pve_update_firewall_rule` | Update a firewall rule | full |
| `pve_delete_firewall_rule` | Delete a firewall rule | full |

</details>

<details>
<summary>Backup (5 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_list_backup_jobs` | List all scheduled backup jobs | read-only |
| `pve_get_backup_job` | Get backup job configuration | read-only |
| `pve_run_backup` | Run an immediate backup (vzdump) | read-execute |
| `pve_create_backup_job` | Create a scheduled backup job | full |
| `pve_delete_backup_job` | Delete a scheduled backup job | full |

</details>

<details>
<summary>Tasks (4 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_list_tasks` | List recent tasks on a node | read-only |
| `pve_get_task_status` | Get task status by UPID | read-only |
| `pve_get_task_log` | Get task log output by UPID | read-only |
| `pve_stop_task` | Stop a running task | read-execute |

</details>

<details>
<summary>High Availability (5 tools)</summary>

| Tool | Description | Access |
|------|-------------|--------|
| `pve_list_ha_resources` | List all HA-managed resources | read-only |
| `pve_get_ha_resource` | Get HA configuration for a resource | read-only |
| `pve_create_ha_resource` | Add a VM/container to HA management | full |
| `pve_update_ha_resource` | Update HA resource configuration | full |
| `pve_delete_ha_resource` | Remove a resource from HA management | full |

</details>

## Verify It Works

After configuring your MCP client, ask your AI assistant:

> "What nodes are in my Proxmox cluster?"

If the connection is working, the assistant will call `pve_list_nodes` and return your nodes with their current status.

## Usage Examples

Once configured, ask your AI tool questions in natural language:

- **"List all VMs on node pve1"** -- calls `pve_list_qemu_vms` to show VMs with their status, CPU, and memory usage.

- **"What's the status of VM 100?"** -- calls `pve_get_qemu_status` to show real-time resource utilization.

- **"Start container 200 on pve1"** -- calls `pve_start_lxc_container` to start the container and returns the task UPID.

- **"Create a snapshot of VM 100 called pre-upgrade"** -- calls `pve_create_qemu_snapshot` to create a snapshot before changes.

- **"Show me the cluster resources"** -- calls `pve_list_cluster_resources` to show all VMs, containers, storage, and nodes.

- **"Migrate VM 100 to node pve2"** -- calls `pve_migrate_qemu_vm` to live-migrate the VM to another node.

## Troubleshooting

**Connection refused / ECONNREFUSED**
Check that `PVE_BASE_URL` is correct and includes the port (default: 8006). Ensure the PVE host is reachable from where the MCP server is running.

**SSL certificate errors**
If your PVE instance uses a self-signed certificate, set `PVE_VERIFY_SSL=false`. This disables TLS verification for all requests.

**Invalid credentials / 401 Unauthorized**
Verify your API token ID and secret are correct. The token ID format is `user@realm!tokenname` (e.g. `root@pam!mcp`). Check that "Privilege Separation" is unchecked if you need full user permissions.

**Tools not showing up in your AI tool**
Check your access tier setting. In `read-only` mode, only 51 tools are registered. In `read-execute` mode, 68 tools are registered. Use `full` (or omit `PVE_ACCESS_TIER`) for all 105 tools. Check `PVE_CATEGORIES` -- only tools in listed categories are registered. Also verify the server started without errors by checking stderr output.

**Node.js version errors**
mcp-pve requires Node.js >= 18.0.0. Check your version with `node --version`.

**Parse errors or "invalid JSON" in MCP client**
This typically means something is writing to stdout besides the MCP server. Ensure no other tools, shell profiles, or startup scripts print to stdout when launching the server. The MCP protocol uses stdout for JSON-RPC communication. All mcp-pve logging goes to stderr.

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode (auto-reload)
npm run dev

# Open the MCP Inspector for interactive testing
npm run inspect
```

## License

MIT
