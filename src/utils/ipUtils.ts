export function isValidIp(ip: string | undefined | null): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

export function ipToInt(ip: string | undefined | null): number {
  if (!isValidIp(ip)) return 0;
  return ip!
    .trim()
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0);
}

export function intToIp(intVal: number): string {
  return [
    (intVal >>> 24) & 255,
    (intVal >>> 16) & 255,
    (intVal >>> 8) & 255,
    intVal & 255,
  ].join('.');
}

export function cidrToMask(cidr: number): string {
  if (cidr <= 0) return '0.0.0.0';
  if (cidr >= 32) return '255.255.255.255';
  const maskInt = ((0xffffffff << (32 - cidr)) >>> 0);
  return intToIp(maskInt);
}

export function maskToCidr(mask: string): number {
  if (!isValidIp(mask)) return 24;
  const maskInt = ipToInt(mask);
  let count = 0;
  for (let i = 31; i >= 0; i--) {
    if ((maskInt & (1 << i)) !== 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function maskToWildcard(mask: string): string {
  if (!isValidIp(mask)) return '0.0.0.255';
  const maskInt = ipToInt(mask);
  const wildcardInt = (~maskInt) >>> 0;
  return intToIp(wildcardInt);
}

export function wildcardToMask(wildcard: string): string {
  if (!isValidIp(wildcard)) return '255.255.255.0';
  const wildcardInt = ipToInt(wildcard);
  const maskInt = (~wildcardInt) >>> 0;
  return intToIp(maskInt);
}

export function getNetworkAddress(ip: string, mask: string): string {
  const ipInt = ipToInt(ip);
  const maskInt = ipToInt(mask);
  return intToIp((ipInt & maskInt) >>> 0);
}

export function getBroadcastAddress(ip: string, mask: string): string {
  const ipInt = ipToInt(ip);
  const maskInt = ipToInt(mask);
  const wildcardInt = (~maskInt) >>> 0;
  return intToIp((ipInt | wildcardInt) >>> 0);
}

export function areSameSubnet(ip1: string, ip2: string, mask: string): boolean {
  if (!isValidIp(ip1) || !isValidIp(ip2) || !isValidIp(mask)) return false;
  return getNetworkAddress(ip1, mask) === getNetworkAddress(ip2, mask);
}

export function getSubnetDetails(ip: string, cidrOrMask: number | string) {
  const cidr = typeof cidrOrMask === 'number' ? cidrOrMask : maskToCidr(cidrOrMask);
  const mask = cidrToMask(cidr);
  const wildcard = maskToWildcard(mask);
  const netAddr = getNetworkAddress(ip, mask);
  const bcastAddr = getBroadcastAddress(ip, mask);

  const netInt = ipToInt(netAddr);
  const bcastInt = ipToInt(bcastAddr);

  let firstUsable = 'N/A';
  let lastUsable = 'N/A';
  let usableHosts = 0;
  const totalHosts = Math.pow(2, 32 - cidr);

  if (cidr === 31) {
    firstUsable = netAddr;
    lastUsable = bcastAddr;
    usableHosts = 2; // RFC 3021
  } else if (cidr === 32) {
    firstUsable = netAddr;
    lastUsable = netAddr;
    usableHosts = 1;
  } else {
    firstUsable = intToIp(netInt + 1);
    lastUsable = intToIp(bcastInt - 1);
    usableHosts = Math.max(0, totalHosts - 2);
  }

  // Generate 32-bit binary representation of IP
  const ipBinary = ip
    .split('.')
    .map((oct) => Number(oct).toString(2).padStart(8, '0'))
    .join('');

  return {
    ip,
    cidr,
    mask,
    wildcard,
    networkAddress: netAddr,
    broadcastAddress: bcastAddr,
    firstUsable,
    lastUsable,
    usableHosts,
    totalHosts,
    ipBinary,
  };
}

export function generateRandomMac(prefix: string = '00:1c:b1'): string {
  const randomHex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return `${prefix}:${randomHex()}:${randomHex()}:${randomHex()}`.toLowerCase();
}

export interface VlsmRequirement {
  name: string;
  neededHosts: number;
}

export interface VlsmAllocatedSubnet {
  name: string;
  neededHosts: number;
  allocatedHosts: number;
  cidr: number;
  mask: string;
  wildcard: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsable: string;
  lastUsable: string;
}

export function calculateVlsmSubnets(
  baseNetwork: string,
  baseCidr: number,
  requirements: VlsmRequirement[]
): { allocated: VlsmAllocatedSubnet[]; totalAllocatedAddresses: number; error?: string } {
  if (!isValidIp(baseNetwork)) {
    return { allocated: [], totalAllocatedAddresses: 0, error: 'Invalid base network IP address.' };
  }

  // Sort requirements descending by needed hosts
  const sortedReqs = [...requirements].sort((a, b) => b.neededHosts - a.neededHosts);
  let currentStartInt = ipToInt(getNetworkAddress(baseNetwork, cidrToMask(baseCidr)));
  const baseEndInt = ipToInt(getBroadcastAddress(baseNetwork, cidrToMask(baseCidr)));

  const allocated: VlsmAllocatedSubnet[] = [];
  let totalAllocatedAddresses = 0;

  for (const req of sortedReqs) {
    if (req.neededHosts <= 0) continue;

    // Find smallest power of 2 that accommodates neededHosts + 2 (network & broadcast)
    let hostBits = 1;
    while (Math.pow(2, hostBits) - 2 < req.neededHosts && hostBits < 30) {
      hostBits++;
    }

    const cidr = 32 - hostBits;
    const totalHosts = Math.pow(2, hostBits);
    const mask = cidrToMask(cidr);
    const wildcard = maskToWildcard(mask);

    const netAddress = intToIp(currentStartInt);
    const bcastAddressInt = currentStartInt + totalHosts - 1;

    if (bcastAddressInt > baseEndInt) {
      return {
        allocated,
        totalAllocatedAddresses,
        error: `Insufficient IP space in ${baseNetwork}/${baseCidr} to allocate subnet "${req.name}" (${req.neededHosts} hosts).`,
      };
    }

    const firstUsable = intToIp(currentStartInt + 1);
    const lastUsable = intToIp(bcastAddressInt - 1);

    allocated.push({
      name: req.name,
      neededHosts: req.neededHosts,
      allocatedHosts: Math.max(0, totalHosts - 2),
      cidr,
      mask,
      wildcard,
      networkAddress: netAddress,
      broadcastAddress: intToIp(bcastAddressInt),
      firstUsable,
      lastUsable,
    });

    totalAllocatedAddresses += totalHosts;
    currentStartInt = bcastAddressInt + 1;
  }

  return { allocated, totalAllocatedAddresses };
}

/**
 * Safely parses interface ranges like "Fa0/1-24", "Gi0/1 - 4, Fa0/12",
 * returning an array of valid interface names. Guaranteed to never throw on any input.
 */
export function parseInterfaceRange(
  rangeStr: string | undefined | null,
  availableInterfaces: Record<string, any> = {}
): string[] {
  if (!rangeStr || typeof rangeStr !== 'string') return [];

  const results: string[] = [];
  const segments = rangeStr.split(',').map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const dashMatch = seg.match(/^([a-zA-Z]+[\d\/]*?)(\d+)\s*-\s*(\d+)$/);
    if (dashMatch) {
      const prefix = dashMatch[1];
      const startNum = parseInt(dashMatch[2], 10);
      const endNum = parseInt(dashMatch[3], 10);
      if (!isNaN(startNum) && !isNaN(endNum) && startNum <= endNum && endNum - startNum <= 256) {
        for (let i = startNum; i <= endNum; i++) {
          results.push(`${prefix}${i}`);
        }
        continue;
      }
    }

    if (seg.length > 0) {
      results.push(seg);
    }
  }

  if (availableInterfaces && Object.keys(availableInterfaces).length > 0) {
    return results.filter((name) => availableInterfaces[name] !== undefined);
  }

  return results;
}
