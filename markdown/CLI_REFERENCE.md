# WireCraft CLI Reference & Multi-Vendor Guide

> [📖 Doc Hub](./INDEX.md) • [🏗️ Architecture](./ARCHITECTURE.md) • [💻 CLI Reference](./CLI_REFERENCE.md) • [🔌 REST API](./API.md) • [🧪 Testing](./TESTING.md) • [🚀 Deployment](./DEPLOYMENT.md) • [🔒 Security](./SECURITY.md) • [🗺️ Roadmap](./ROADMAP.md) • [🏷️ Brand Guide](./BRAND_LOC.md) • [🤝 Contributing](./CONTRIBUTING.md)

WireCraft provides an authentic, high-fidelity command-line interface (CLI) supporting genuine Cisco IOS syntax and multi-vendor command translation.

---

## 1. CLI Execution Modes & Prompt Hierarchy

```
[ User EXEC Mode ]            Prompt: Router>
        │ Type 'enable'
        ▼
[ Privileged EXEC Mode ]      Prompt: Router#
        │ Type 'configure terminal'
        ▼
[ Global Configuration Mode ] Prompt: Router(config)#
        ├── interface <name>       ───> [ Interface Config ]       Prompt: Router(config-if)#
        ├── router ospf <id>       ───> [ Router OSPF Config ]     Prompt: Router(config-router)#
        ├── router rip             ───> [ Router RIP Config ]      Prompt: Router(config-router)#
        ├── router eigrp <as>      ───> [ Router EIGRP Config ]    Prompt: Router(config-router)#
        ├── line console 0         ───> [ Line Config ]            Prompt: Router(config-line)#
        ├── line vty 0 4           ───> [ Line Config ]            Prompt: Router(config-line)#
        ├── vlan <id>              ───> [ VLAN Config ]            Prompt: Router(config-vlan)#
        └── ip access-list ext <n> ───> [ Extended ACL Config ]    Prompt: Router(config-ext-nacl)#
```

### Navigation Rules
- `exit`: Moves up exactly one level in the hierarchy.
- `end` or `Ctrl+Z`: Jumps directly back to Privileged EXEC (`Router#`) from any sub-mode.
- `do <command>`: Executes any Privileged EXEC command (e.g., `do show ip route`) from within Global or Sub-configuration modes without exiting.
- `logout`: Closes the terminal session and resets to User EXEC.

---

## 2. Interactive Terminal Keyboard Shortcuts

- `Tab`: Autocompletes commands and interface identifiers.
- `?`: Contextual inline help listing available commands in the current mode.
- `Up / Down Arrows`: Recalls command history.
- `Ctrl + C`: Interrupts running operations or cancels current line.
- `| include <text>`: Filters output to lines matching text.
- `| section <text>`: Displays config blocks matching section header.
- `| begin <text>`: Displays output starting from the first matching line.

---

## 3. The Complete 107 Commands Reference

### 3.1 Mode Navigation & System Lifecycle
1. `enable` - Enters privileged EXEC mode.
2. `disable` - Exits privileged EXEC mode back to user EXEC mode.
3. `configure terminal` - Enters global configuration mode.
4. `exit` - Exits current mode or terminates connection.
5. `end` - Immediately returns to privileged EXEC mode.
6. `logout` - Terminates active CLI session.
7. `reload` - Reboots the virtual router or switch.

### 3.2 Configuration Storage & Memory Management
8. `show running-config` - Displays active RAM configuration.
9. `show startup-config` - Displays NVRAM saved configuration.
10. `copy running-config startup-config` - Saves active configuration to NVRAM.
11. `erase startup-config` - Deletes NVRAM configuration file.
12. `show flash` - Lists files stored in flash memory.
13. `show boot` - Displays boot variables and config register.
14. `mkdir [directory]` - Creates a directory in local storage/flash.
15. `dir` - Displays directory listing of local flash filesystem.

### 3.3 Hardware & System Monitoring
16. `show version` - Displays software version, uptime, and bootstrap info.
17. `show ip interface brief` - Summary table of interfaces, IPs, and L1/L2 status.
18. `show interfaces` - Detailed statistics and packet counters per interface.
19. `show history` - Shows command history buffer.
20. `show clock` - Displays system date and time.
21. `show hosts` - Displays local hostname cache.
22. `show users` - Lists active terminal and console sessions.
23. `show inventory` - Displays hardware PIDs, serial numbers, and modules.
24. `show processes cpu` - Displays CPU core utilization.
25. `show processes memory` - Displays memory allocations and free bytes.
26. `show tech-support` - Generates consolidated troubleshooting diagnostic dump.

### 3.4 Management Lines & Security Configuration
27. `hostname [name]` - Assigns device hostname.
28. `enable password [pwd]` - Sets unencrypted enable password.
29. `enable secret [pwd]` - Sets MD5/Type-5 encrypted enable password.
30. `service password-encryption` - Obfuscates cleartext passwords in configuration.
31. `banner motd [char]` - Configures Message of the Day login banner.
32. `line console 0` - Enters physical console port configuration.
33. `line vty 0 4` - Enters Telnet/SSH management line configuration.
34. `password [pwd]` - Sets password on access line.
35. `login` - Enables password authentication on line.
36. `exec-timeout [min] [sec]` - Sets inactivity timeout interval.
37. `logging synchronous` - Prevents syslog messages from interrupting command typing.

### 3.5 Interface Configuration & Port Parameters
38. `interface [type/num]` - Enters interface configuration mode.
39. `ip address [ip] [mask]` - Configures IPv4 address and subnet mask.
40. `ipv6 address [ip/prefix]` - Configures IPv6 address.
41. `description [text]` - Adds administrative label to interface.
42. `shutdown` - Administratively disables an interface.
43. `no shutdown` - Administratively enables an interface.
44. `speed [auto|10|100|1000]` - Manually sets interface port speed.
45. `duplex [auto|half|full]` - Sets port duplex mode.
46. `ip address dhcp` - Configures interface to obtain address via DHCP.

### 3.6 Switching, VLANs & 802.1Q Trunking
47. `vlan [id]` - Creates or configures a VLAN ID.
48. `name [vlan-name]` - Assigns descriptive name to VLAN.
49. `show vlan brief` - Summary table of VLANs and assigned ports.
50. `switchport mode access` - Configures port as static access mode.
51. `switchport access vlan [id]` - Assigns access port to specific VLAN.
52. `switchport mode trunk` - Configures port as 802.1Q trunk.
53. `switchport trunk allowed vlan [ids]` - Specifies allowed VLAN list on trunk.
54. `switchport trunk native vlan [id]` - Sets untagged native VLAN ID.
55. `show interfaces trunk` - Displays active trunk links and allowed VLANs.
56. `show mac address-table` - Displays CAM forwarding table.
57. `clear mac address-table dynamic` - Flushes dynamic MAC table entries.

### 3.7 Spanning Tree Protocol (STP 802.1D)
58. `spanning-tree mode [pvst|rapid-pvst|mst]` - Sets global STP operational mode.
59. `spanning-tree vlan [id] root primary` - Sets priority to 24576 to become root bridge.
60. `spanning-tree vlan [id] root secondary` - Sets priority to 28672 as backup root.
61. `spanning-tree portfast` - Bypasses listening/learning on edge ports.
62. `spanning-tree bpduguard enable` - Shuts down port if BPDU packet received.
63. `show spanning-tree` - Displays root bridge ID, bridge priority, and port roles.

### 3.8 Static & Dynamic Routing (OSPF, RIP, EIGRP)
64. `ip routing` - Enables IPv4 packet routing engine.
65. `ipv6 unicast-routing` - Enables IPv6 global routing.
66. `ip route [net] [mask] [next_hop]` - Configures static IPv4 route.
67. `ipv6 route [prefix] [next_hop]` - Configures static IPv6 route.
68. `show ip route` - Displays IPv4 routing table.
69. `show ipv6 route` - Displays IPv6 routing table.
70. `router rip` - Enters RIP routing configuration.
71. `version 2` - Selects RIP version 2.
72. `router ospf [process-id]` - Enters OSPFv2 routing process configuration.
73. `network [net] [wildcard] area [id]` - Binds interfaces to OSPF area.
74. `passive-interface [if_type/num]` - Suppresses routing advertisements out port.
75. `router eigrp [as-number]` - Enters EIGRP process configuration.
76. `no auto-summary` - Disables automatic classful boundary summarization.
77. `show ip ospf neighbor` - Displays OSPF neighbor adjacencies and states (FULL/DR/BDR).
78. `show ip eigrp neighbors` - Displays EIGRP neighbor adjacencies.

### 3.9 DHCP Server Services
79. `ip dhcp excluded-address [low] [high]` - Excludes address range from pool.
80. `ip dhcp pool [name]` - Creates and enters DHCP pool configuration.
81. `network [net] [mask]` - Defines assignable subnet in DHCP pool.
82. `default-router [ip]` - Sets default gateway option (Option 3).
83. `dns-server [ip1] [ip2]` - Sets DNS server addresses (Option 6).

### 3.10 Network Address Translation (NAT)
84. `ip nat inside source static [local] [global]` - Configures 1:1 static NAT rule.
85. `ip nat inside` - Designates interface as private internal domain.
86. `ip nat outside` - Designates interface as public external domain.
87. `show ip nat translations` - Displays active translation table.

### 3.11 Access Control Lists (ACLs)
88. `access-list [1-99] [permit|deny] [source] [wildcard]` - Creates standard IPv4 ACL.
89. `ip access-list extended [name|num]` - Enters extended named/numbered ACL configuration.
90. `ip access-group [id] [in|out]` - Applies ACL filter inbound or outbound on interface.

### 3.12 Layer 2 Discovery & Utilities
91. `ping [ip|hostname]` - Sends ICMP Echo requests to test connectivity.
92. `traceroute [ip|hostname]` - Traces hop-by-hop packet path.
93. `telnet [ip|hostname]` - Initiates unencrypted remote terminal session.
94. `ssh -l [username] [ip]` - Initiates secure shell terminal session.
95. `cdp run` - Enables Cisco Discovery Protocol globally.
96. `no cdp run` - Disables Cisco Discovery Protocol globally.
97. `show cdp neighbors` - Lists directly connected CDP neighbors.
98. `show cdp neighbors detail` - Displays detailed neighbor IP, platform, and port info.
99. `show arp` - Displays Address Resolution Protocol IP-to-MAC mappings.
100. `clear arp-cache` - Flushes dynamic ARP cache entries.

---

## 4. Multi-Vendor Rosetta Stone Translation

| Function | Cisco IOS | Juniper Junos | Arista EOS | Linux / VyOS | MikroTik RouterOS |
|---|---|---|---|---|---|
| **Enter Config** | `configure terminal` | `configure` | `configure terminal` | `configure` | `/` |
| **Commit Changes** | *(Instant in RAM)* | `commit` | *(Instant in RAM)* | `commit` | *(Instant in RAM)* |
| **Show Interfaces** | `show ip int brief` | `show interfaces terse` | `show ip int brief` | `ip -br a` | `/ip address print` |
| **Set Interface IP** | `ip address 10.0.0.1 255.255.255.0` | `set interfaces ge-0/0/0 unit 0 family inet address 10.0.0.1/24` | `ip address 10.0.0.1/24` | `ip addr add 10.0.0.1/24 dev eth0` | `/ip address add address=10.0.0.1/24 interface=ether1` |
| **Set Default Route** | `ip route 0.0.0.0 0.0.0.0 10.0.0.254` | `set routing-options static route 0.0.0.0/0 next-hop 10.0.0.254` | `ip route 0.0.0.0/0 10.0.0.254` | `ip route add default via 10.0.0.254` | `/ip route add dst-address=0.0.0.0/0 gateway=10.0.0.254` |
| **Show Route Table** | `show ip route` | `show route` | `show ip route` | `ip route show` | `/ip route print` |
| **Enable OSPF** | `router ospf 1` | `set protocols ospf area 0.0.0.0` | `router ospf 1` | `set protocols ospf area 0` | `/routing ospf instance add name=default` |
| **Show OSPF Neighbors** | `show ip ospf neighbor` | `show ospf neighbor` | `show ip ospf neighbor` | `vtysh -c 'show ip ospf neighbor'` | `/routing ospf neighbor print` |
