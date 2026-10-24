export const CCNA_TIPS = [
  "Rule #1: It's always DNS. Until it's MTU mismatch, then it's definitely MTU.",
  "Spanning Tree Protocol: preventing bridging loops since Radia Perlman wrote the algorithmic poem in 1985.",
  "Remember: In OSPF, Area 0 (Backbone) must be contiguous. If not, break out your virtual links!",
  "Subnetting trick: 256 minus the interesting octet = block size. Never do binary by hand in a panic!",
  "An unconfigured switch is a hub with expensive delusions of grandeur.",
  "Never run 'reload' on a remote router without 'reload in 10' first. Save your career!",
  "Trunking: Check your native VLANs! Mismatched native VLANs leak traffic like a perforated sieve.",
  "Administrative Distances: Connected 0, Static 1, eBGP 20, EIGRP 90, OSPF 110, RIP 120, iBGP 200.",
  "MAC addresses are local to the broadcast domain; IP addresses traverse the globe.",
];

export function handleCliEasterEggs(line: string): string | null {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();

  // sudo make me a sandwich
  if (lower === 'make me a sandwich') {
    return 'What? Make it yourself.';
  }
  if (lower === 'sudo make me a sandwich') {
    return [
      '[===🥪===]',
      'Order up! Here is your Gigabit BLT Packet Sandwich:',
      '  +---------------------------------------------+',
      '  | [BREAD]     RFC 1149 Carrier Pigeon Sourdough |',
      '  | [BACON]     10 Gbps Crispy Throughput         |',
      '  | [LETTUCE]   Zero Dropped Frames               |',
      '  | [TOMATO]    Sub-1ms Jitter & High QoS         |',
      '  | [MAYO]      Full-Duplex Lubrication           |',
      '  | [BREAD]     Spanning-Tree Forwarding Crust    |',
      '  +---------------------------------------------+',
      'Enjoy your snack, certified network engineer!',
    ].join('\n');
  }

  // HTCPCP Coffee Pot (RFC 2324)
  if (
    lower === 'show coffee' ||
    lower === 'brew coffee' ||
    lower === 'coffee' ||
    lower === 'teapot' ||
    lower === 'rfc 2324' ||
    lower === 'rfc2324'
  ) {
    return [
      "HTCPCP/1.0 418 I'm a teapot (RFC 2324 Compliant)",
      '',
      '       (  )   (   )  )',
      '        ) (   )  (  (',
      '        ( )  (    ) )',
      '        _____________',
      '       <_____________> ___',
      '       |             |/ _ \\',
      '       | WireCraft   | | | |',
      '       | Espresso    | |_| |',
      '       | Fresh Brew  |\\___/',
      '       \\_____________/',
      '',
      'Stream: Hyper Text Coffee Pot Control Protocol (HTCPCP)',
      'Roast: High-Priority Expedited Forwarding (DSCP EF/46)',
      'Boiler Temp: 93.8°C | Pressure: 15.2 bar | Crema: Rich & Thick',
      'Notice: Network engineer is fully caffeinated. 0 packet drops observed.',
    ].join('\n');
  }

  // cowsay
  if (lower === 'cowsay' || lower.startsWith('cowsay ')) {
    const rawMsg = trimmed.slice(6).trim();
    const msg =
      rawMsg || 'Default Gateway is the true friend that never leaves your subnet behind.';
    const border = '-'.repeat(msg.length + 2);
    return [
      ` ${'_'.repeat(msg.length + 2)}`,
      `< ${msg} >`,
      ` ${border}`,
      '        \\   ^__^',
      '         \\  (oo)\\_______',
      '            (__)\\       )\\/\\',
      '                ||----w |',
      '                ||     ||',
    ].join('\n');
  }

  // blinkenlights
  if (lower === 'blinkenlights' || lower === 'show blinkenlights') {
    return [
      ' [--- WIRECRAFT CHASSIS BLINKENLIGHTS ---]',
      ' Fa0/1: [🟢 LNK/ACT] [⚡ 1000M]   Fa0/2: [🟢 LNK/ACT] [⚡ 1000M]',
      ' Fa0/3: [🟡 STP/BLK] [   100M]   Fa0/4: [⚪ NO-CBL ] [   DOWN]',
      ' Gi0/1: [🟢 802.1Q ] [⚡  10G ]   Gi0/2: [🟢 TRUNK  ] [⚡  10G ]',
      ' PWR 1: [🟢 NORMAL ]             PWR 2: [🟢 REDUNDANT]',
      ' FAN 1: [🟢 4800RPM]             TEMP : [🟢 28.5°C OPTIMAL]',
      '',
      ' "ACHTUNG! Alles touristen und non-technischen lookenspeepers!',
      '  Das computermachine ist nicht fuer gefingerpoken und mittengrabben!"',
    ].join('\n');
  }

  // fortune / tip
  if (lower === 'fortune' || lower === 'tip' || lower === 'ccna tip' || lower === 'show tip') {
    const randomIndex = Math.floor(Math.random() * CCNA_TIPS.length);
    return `💡 [CCNA Golden Rule #${randomIndex + 1}]:\n${CCNA_TIPS[randomIndex]}`;
  }

  return null;
}
