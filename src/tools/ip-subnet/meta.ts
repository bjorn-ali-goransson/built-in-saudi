import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { NetworkIcon } from '../../components/icons'

export const ipSubnetTool: Tool = {
  id: 'ip-subnet',
  name: 'IP Subnet Calculator',
  tagline: 'CIDR to network, broadcast, range and host count.',
  description:
    'Enter an IPv4 address with a CIDR prefix (e.g. 192.168.1.10/24) to get the network and broadcast addresses, the usable host range, the subnet mask and wildcard, and the number of usable hosts. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['ip', 'subnet', 'cidr', 'netmask', 'network', 'broadcast', 'ipv4', 'شبكة', 'قناع الشبكة', 'آي بي'],
  status: 'stable',
  Icon: NetworkIcon,
  component: lazyTool(() => import('./IpSubnetTool')),
  ar: {
    name: 'حاسبة الشبكات الفرعية',
    tagline: 'من CIDR إلى الشبكة والبثّ والنطاق وعدد المضيفين.',
    description:
      'أدخل عنوان IPv4 مع بادئة CIDR (مثل 192.168.1.10/24) لتحصل على عنواني الشبكة والبثّ، ونطاق المضيفين القابل للاستخدام، وقناع الشبكة والقناع البديل، وعدد المضيفين القابلين للاستخدام. يعمل بالكامل في متصفحك.',
  },
}
