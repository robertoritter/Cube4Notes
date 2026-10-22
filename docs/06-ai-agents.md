# AI agents (MCP)

AI agents (Claude Code, LM Studio, other MCP clients) can **read** Cube4Notes notes. Access lives inside the server itself, at `/mcp`, and follows the MCP protocol (JSON-RPC over HTTP). Decision recorded in [ADR 0004](adr/0004-read-only-ai-agents-mcp.md).

## What an agent can do

| Tool | What it does |
| --- | --- |
| `list_vaults` | lists the vaults the agent is allowed to use |
| `list_notes` | lists the note paths of a vault, or of a folder in it |
| `read_note` | reads the full Markdown of a note |
| `search_notes` | finds notes containing all the words (ignoring accents and case), with path and snippet |
| `recent_notes` | most recently changed notes |

And what it **cannot** do:

- change, create, rename or delete notes (the agent token is refused on any change);
- administer the server, see devices or create invitations;
- read vaults it was not given access to;
- access the disk: it only sees the notes, through the server.

## Create the access

1. On an administrator device, open **Preferences > Connect device > AI agents > Create agent access**.
2. Give the agent a name and choose the vaults it can read.
3. Copy the **token**: it is shown only once. If you lose it, remove the agent and create another one.

The same screen shows the ready-made command for Claude Code and the JSON configuration for other clients. To revoke access, remove the agent from the same list.

Each Cube4Notes server has its own tokens: a token created on one computer does not work on another.

![Agent access created: token and MCP addresses](images/ai-agent.png)

## Agent on the server's own computer

On the same computer, the agent can use plain HTTP (the token never leaves the machine). Example for Claude Code, in *Home network* mode:

```bash
claude mcp add --transport http cube4notes http://localhost:43124/mcp --header "Authorization: Bearer <token>"
```

In *This computer only* mode, the port is 43125.

## Agent on another machine on the network (LM Studio, Claude Code, scripts)

Over the network, access is always HTTPS: `https://<server-ip>:43125/mcp`, with the same `Authorization: Bearer <token>` header. The server certificate is signed by the authority created by Cube4Notes itself, so the agent's program needs to trust it. Without that, you get an error such as `unable to verify the first certificate` or `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

Installing the certificate on Windows or macOS is **not enough** for programs built on Node.js (LM Studio, Claude Code and many MCP clients), nor for Python: they use their own list of authorities. That is why the server also serves the authority in PEM, the format they accept:

```
http://<server-ip>:43124/cube4notes-ca.pem
```

1. Download the file to the agent's machine, for example `C:\Users\<user>\cube4notes-ca.pem` or `~/cube4notes-ca.pem`.
2. Tell the program to trust it:
   - **Node.js (LM Studio, Claude Code, Node-based MCP clients)**: the `NODE_EXTRA_CA_CERTS` environment variable pointing to the file. On Windows: `setx NODE_EXTRA_CA_CERTS "C:\Users\<user>\cube4notes-ca.pem"`; on Linux/macOS, `export NODE_EXTRA_CA_CERTS=~/cube4notes-ca.pem` in the shell profile. Then **quit the program completely** (in LM Studio, also from the icon near the clock) and open it again, because the variable only applies to programs started after it is set.
   - **Python** (`requests`, `httpx`): `REQUESTS_CA_BUNDLE` or `SSL_CERT_FILE` pointing to the file.
   - **curl**: `curl --cacert cube4notes-ca.pem https://<server-ip>:43125/api/status`.
3. Configure the MCP server in the program. In LM Studio (`mcp.json`):

```json
{
  "mcpServers": {
    "cube4notes": {
      "url": "https://<server-ip>:43125/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

Each Cube4Notes server has its own authority. If the agent uses two servers, put both PEM files into a single file (one after the other). If the server's authority changes (`tls` folder deleted or a different computer), download the PEM again.

Do not turn off certificate verification (`NODE_TLS_REJECT_UNAUTHORIZED=0`, `verify=False`): the agent token would go to any machine that answered at that address.

## Limits

- There are no agents on iPhone and iPad: access is for programs running on computers on the home network.
- The agent sees the text of the notes as it is on disk, including properties and links. The MCP tools do not deliver attachments, but the agent token also works on the read routes of the API for the same vaults (for example `GET /api/v/{vault}/raw`), so anyone with the token can download images and PDFs from those vaults.
