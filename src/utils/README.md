# WireCraft Utility Libraries (`/src/utils`)

> [📖 Doc Hub](../../markdown/INDEX.md) • [🧪 Testing Methodology](../../markdown/TESTING.md)

This directory provides pure, battle-tested utility functions supporting IP networking arithmetic, memory manipulation, and UI window geometry.

---

## 🛠️ Modules & Capabilities

### 1. `ipUtils.ts` (Network & Subnet Calculations)
- **`isValidIp(ip)`**: Validates standard dotted-decimal IPv4 address strings (`0.0.0.0` - `255.255.255.255`).
- **`ipToInt(ip)` & `intToIp(int)`**: Converts IPv4 strings to 32-bit unsigned integers for bitwise masking operations.
- **`cidrToMask(cidr)` & `maskToCidr(mask)`**: Bidirectional translation between bit-length prefixes (`/24`) and dotted subnet masks (`255.255.255.0`).
- **`getNetworkAddress(ip, mask)` & `getBroadcastAddress(ip, mask)`**: Calculates network and broadcast boundaries for any subnet.
- **`areSameSubnet(ipA, ipB, mask)`**: Fast bitwise check verifying if two hosts belong to the same local broadcast domain.
- **`isIpInSubnet(ip, net, mask)`**: Checks whether an IP resides within an arbitrary network boundary.
- **`matchesWildcard(ip, network, wildcard)`**: Implements Cisco IOS inverse wildcard mask evaluation for OSPF and Access Control Lists (ACLs).
- **`parseInterfaceRange(rangeStr, interfaces)`**: Expands Cisco IOS interface range strings (e.g. `FastEthernet0/1 - 12, GigabitEthernet0/1 - 2`) into concrete interface identifier arrays.

### 2. `deepClone.ts` (Safe Structural Cloning)
- High-performance recursive cloner supporting complex nested device and topology configurations.
- **Circular Reference Immunity**: Uses a `WeakMap` tracker to safely clone graph structures containing back-references without exceeding call stack limits.
- **Prototype Preservation**: Correctly handles Date objects, Arrays, and plain Objects.

### 3. `windowLayout.ts` (Desktop Window Geometry)
- **`tileWindows(windows, viewportWidth, viewportHeight)`**: Calculates optimal non-overlapping grid dimensions and coordinate positions for any arbitrary count of open floating terminal windows.
- **`cascadeWindows(windows, viewportWidth, viewportHeight)`**: Computes staggered diagonal arrangements ensuring each window title bar remains visible and clickable.
