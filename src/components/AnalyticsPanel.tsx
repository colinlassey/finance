import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '../lib/format';

type Props = {
  sankeyData: { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] };
  vendorData: { name: string; value: number }[];
  categoryData: { name: string; value: number }[];
};

export const AnalyticsPanel = ({ sankeyData, vendorData, categoryData }: Props) => (
  <>
    <section className="card lg:col-span-12 h-[340px]">
      <h2 className="section-title">Cash Flow Sankey (Income → Accounts → Expenses)</h2>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey data={sankeyData} nodePadding={24} margin={{ left: 20, right: 20, top: 30, bottom: 20 }} link={{ stroke: '#60a5fa' }}>
          <Tooltip />
        </Sankey>
      </ResponsiveContainer>
    </section>

    <section className="card lg:col-span-6 h-[300px]">
      <h2 className="section-title">Top Vendors by Spend</h2>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={vendorData} dataKey="value" nameKey="name" outerRadius={95} label>
            {vendorData.map((_, idx) => <Cell key={idx} fill={["#22c55e", "#60a5fa", "#f59e0b", "#f43f5e", "#a78bfa"][idx % 5]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
        </PieChart>
      </ResponsiveContainer>
    </section>

    <section className="card lg:col-span-6 h-[300px]">
      <h2 className="section-title">Category Spend</h2>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={categoryData}>
          <XAxis dataKey="name" stroke="#a1a1aa" />
          <YAxis stroke="#a1a1aa" />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Bar dataKey="value" fill="#60a5fa" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  </>
);
