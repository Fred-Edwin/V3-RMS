'use client'

import { useState } from 'react'
import {
  LayoutDashboard, ShoppingCart, ChefHat, Users,
  Calendar, Clock, BarChart2, Bell, UserCircle,
  Inbox, AlertCircle,
} from 'lucide-react'

import {
  Spinner, Badge, Divider, Avatar, PriceDisplay, ConnectionIndicator, TimeElapsed,
  Button, IconButton,
  Input, Textarea, Select, Toggle, FormField, DatePicker, TimePicker,
  BottomNav, SidebarNav, TopBar,
  Card, CardHeader, CardBody, CardFooter, StatCard, OrderCard, KDSCard, MenuItemCard, StaffCard,
  Modal, BottomSheet, Popover, ConfirmDialog,
  EmptyState,
  SkeletonBlock, SkeletonCard, SkeletonTable,
  Table,
  type TableColumn,
  type OrderStatus,
  type BadgeVariant,
} from '@/components/ui'
import { useToast } from '@/hooks/useToast'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <h2 className="text-heading-md font-sans font-semibold text-stone-900 border-b border-stone-200 pb-2 mb-6">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-4 items-start ${className ?? ''}`}>
      {children}
    </div>
  )
}

function ColorSwatch({ hex, name }: { hex: string; name: string }) {
  return (
    <div className="flex flex-col gap-1 items-center">
      <div className="size-16 rounded-md border border-stone-200 shadow-sm" style={{ backgroundColor: hex }} />
      <span className="text-caption text-stone-600">{name}</span>
      <span className="text-caption text-stone-400">{hex}</span>
    </div>
  )
}

interface SampleRow extends Record<string, unknown> {
  id: string
  name: string
  role: string
  status: string
  orders: number
}

const sampleTableData: SampleRow[] = [
  { id: '1', name: 'James Mwangi', role: 'Waiter', status: 'Active', orders: 24 },
  { id: '2', name: 'Wanjiru Kamau', role: 'Chef', status: 'Active', orders: 18 },
  { id: '3', name: 'Peter Ochieng', role: 'Barista', status: 'Inactive', orders: 0 },
  { id: '4', name: 'Grace Njeri', role: 'Manager', status: 'Active', orders: 5 },
  { id: '5', name: 'Samuel Kibet', role: 'Waiter', status: 'Active', orders: 31 },
]

const tableColumns: TableColumn<SampleRow>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status', render: (val) => (
    <Badge variant={val === 'Active' ? 'ready' : 'closed'} />
  )},
  { key: 'orders', label: 'Orders', sortable: true },
]

const kdsItems = [
  { quantity: 2, name: 'Flat White', notes: 'oat milk' },
  { quantity: 1, name: 'Avocado Toast' },
]

const lateStart = new Date(Date.now() - 22 * 60 * 1000).toISOString()
const normalStart = new Date(Date.now() - 4 * 60 * 1000).toISOString()

export default function ComponentsPage() {
  const { toast } = useToast()

  const [toggleOn, setToggleOn] = useState(false)
  const [dateVal, setDateVal] = useState('2026-03-15')
  const [timeVal, setTimeVal] = useState('08:00')
  const [modalOpen, setModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  function handleConfirm() {
    setConfirmLoading(true)
    setTimeout(() => {
      setConfirmLoading(false)
      setConfirmOpen(false)
      toast({ variant: 'success', title: 'Staff member deactivated' })
    }, 1500)
  }

  const orderStatuses: OrderStatus[] = ['PENDING', 'IN_PROGRESS', 'READY', 'CLOSED', 'CANCELLED']
  const badgeVariants: BadgeVariant[] = ['pending', 'inprogress', 'ready', 'closed', 'cancelled']

  return (
    <div className="min-h-screen bg-crema px-8 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-display-lg font-display text-stone-900 mb-1">Component Catalogue</h1>
        <p className="text-body-md text-stone-500 mb-12">Phase 1.5 — Wendo RMS Design System</p>

        {/* 1. Typography */}
        <Section title="1. Typography">
          <div className="space-y-3">
            <div><span className="text-display-2xl font-display">display-2xl — Cormorant Garamond 56px</span></div>
            <div><span className="text-display-xl font-display">display-xl — Cormorant Garamond 48px</span></div>
            <div><span className="text-display-lg font-display">display-lg — Cormorant Garamond 36px</span></div>
            <Divider />
            <div><span className="text-heading-xl font-sans font-semibold">heading-xl — DM Sans 30px</span></div>
            <div><span className="text-heading-lg font-sans font-semibold">heading-lg — DM Sans 24px</span></div>
            <div><span className="text-heading-md font-sans font-semibold">heading-md — DM Sans 20px</span></div>
            <div><span className="text-heading-sm font-sans font-semibold">heading-sm — DM Sans 18px</span></div>
            <Divider />
            <div><span className="text-body-lg">body-lg — DM Sans 16px regular</span></div>
            <div><span className="text-body-md">body-md — DM Sans 15px regular</span></div>
            <div><span className="text-body-sm">body-sm — DM Sans 14px regular</span></div>
            <Divider />
            <div><span className="text-label-lg font-medium">label-lg — DM Sans 14px medium</span></div>
            <div><span className="text-label-md font-medium">label-md — DM Sans 13px medium</span></div>
            <div><span className="text-label-sm font-medium">label-sm — DM Sans 12px medium</span></div>
            <div><span className="text-caption text-stone-500">caption — DM Sans 12px regular</span></div>
          </div>
        </Section>

        {/* 2. Colors */}
        <Section title="2. Colour Palette">
          <div className="space-y-6">
            <div>
              <p className="text-label-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">Primary</p>
              <Row>
                <ColorSwatch hex="#2C1810" name="Espresso" />
                <ColorSwatch hex="#4A2C1A" name="Espresso Light" />
                <ColorSwatch hex="#F5F0E8" name="Crema" />
                <ColorSwatch hex="#EDE7DC" name="Parchment" />
              </Row>
            </div>
            <div>
              <p className="text-label-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">Accent</p>
              <Row>
                <ColorSwatch hex="#C4862A" name="Amber" />
                <ColorSwatch hex="#F0C97A" name="Amber Light" />
              </Row>
            </div>
            <div>
              <p className="text-label-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">Stone Neutrals</p>
              <Row>
                <ColorSwatch hex="#1C1917" name="Stone 900" />
                <ColorSwatch hex="#44403C" name="Stone 700" />
                <ColorSwatch hex="#78716C" name="Stone 500" />
                <ColorSwatch hex="#D6D3D1" name="Stone 300" />
                <ColorSwatch hex="#E8E5E1" name="Stone 200" />
                <ColorSwatch hex="#F4F2EF" name="Stone 100" />
              </Row>
            </div>
            <div>
              <p className="text-label-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">Semantic</p>
              <Row>
                <ColorSwatch hex="#FDF3DC" name="Pending BG" />
                <ColorSwatch hex="#FEF0E0" name="InProgress BG" />
                <ColorSwatch hex="#EDFAF1" name="Ready BG" />
                <ColorSwatch hex="#F4F4F5" name="Closed BG" />
                <ColorSwatch hex="#FDF2F0" name="Cancelled BG" />
              </Row>
            </div>
          </div>
        </Section>

        {/* 3. Spinner */}
        <Section title="3. Spinner">
          <Row className="items-center">
            <div className="flex flex-col items-center gap-2">
              <Spinner size="sm" />
              <span className="text-caption text-stone-500">sm</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Spinner size="md" />
              <span className="text-caption text-stone-500">md</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Spinner size="lg" />
              <span className="text-caption text-stone-500">lg</span>
            </div>
          </Row>
        </Section>

        {/* 4. Badge */}
        <Section title="4. Badge">
          <div className="space-y-3">
            <div>
              <p className="text-label-sm text-stone-500 mb-2">Default size</p>
              <Row>
                {badgeVariants.map(v => <Badge key={v} variant={v} />)}
              </Row>
            </div>
            <div>
              <p className="text-label-sm text-stone-500 mb-2">Large (KDS)</p>
              <Row>
                {badgeVariants.map(v => <Badge key={v} variant={v} size="lg" />)}
              </Row>
            </div>
          </div>
        </Section>

        {/* 5. Divider */}
        <Section title="5. Divider">
          <div className="space-y-4 max-w-md">
            <Divider />
            <Divider label="or" />
            <Divider label="Today" />
          </div>
        </Section>

        {/* 6. Avatar */}
        <Section title="6. Avatar">
          <Row className="items-center">
            {(['sm', 'md', 'lg'] as const).map(size => (
              <div key={size} className="flex flex-col items-center gap-2">
                <Avatar name="James Mwangi" size={size} />
                <span className="text-caption text-stone-500">{size}</span>
              </div>
            ))}
            <Avatar name="Wanjiru" size="md" />
            <Avatar name="Peter O" size="md" />
          </Row>
        </Section>

        {/* 7. Button */}
        <Section title="7. Button">
          <div className="space-y-4">
            <div>
              <p className="text-label-sm text-stone-500 mb-3">Variants × Sizes</p>
              <div className="space-y-3">
                {(['primary', 'secondary', 'ghost', 'destructive'] as const).map(variant => (
                  <Row key={variant} className="items-center">
                    {(['lg', 'md', 'sm'] as const).map(size => (
                      <Button key={size} variant={variant} size={size}>
                        {variant} {size}
                      </Button>
                    ))}
                  </Row>
                ))}
              </div>
            </div>
            <div>
              <p className="text-label-sm text-stone-500 mb-3">States</p>
              <Row>
                <Button isLoading>Loading</Button>
                <Button disabled>Disabled</Button>
                <Button variant="secondary" isLoading>Loading</Button>
                <Button variant="destructive" isLoading>Loading</Button>
              </Row>
            </div>
          </div>
        </Section>

        {/* 8. IconButton */}
        <Section title="8. IconButton">
          <Row>
            {(['primary', 'secondary', 'ghost', 'destructive'] as const).map(variant => (
              <div key={variant} className="flex flex-col items-center gap-2">
                <IconButton icon={<Bell size={18} />} label={variant} variant={variant} size="md" />
                <span className="text-caption text-stone-500">{variant}</span>
              </div>
            ))}
          </Row>
        </Section>

        {/* 9. PriceDisplay, ConnectionIndicator, TimeElapsed */}
        <Section title="9. Utility Display Components">
          <Row className="items-center gap-8">
            <div>
              <p className="text-label-sm text-stone-500 mb-2">PriceDisplay</p>
              <PriceDisplay amount={1200} />
            </div>
            <div>
              <p className="text-label-sm text-stone-500 mb-2">ConnectionIndicator</p>
              <div className="space-y-1">
                <ConnectionIndicator status="connected" />
                <ConnectionIndicator status="reconnecting" />
                <ConnectionIndicator status="disconnected" />
              </div>
            </div>
            <div>
              <p className="text-label-sm text-stone-500 mb-2">TimeElapsed</p>
              <TimeElapsed startTime={normalStart} />
            </div>
          </Row>
        </Section>

        {/* 10. Input */}
        <Section title="10. Input">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <Input label="Default" placeholder="Enter text..." />
            <Input label="With left icon" leftIcon={<UserCircle size={16} />} placeholder="Enter name..." />
            <Input label="Error state" errorMessage="This field is required" defaultValue="bad input" />
            <Input label="Disabled" disabled defaultValue="Cannot edit" />
            <Input label="With helper" helperText="We'll never share your email." placeholder="email@example.com" />
          </div>
        </Section>

        {/* 11. Textarea */}
        <Section title="11. Textarea">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <Textarea label="Default" placeholder="Write something..." />
            <Textarea label="Error" errorMessage="Notes are required" />
            <Textarea label="Disabled" disabled defaultValue="Cannot edit this" />
          </div>
        </Section>

        {/* 12. Select */}
        <Section title="12. Select">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <Select
              label="Default"
              placeholder="Select role..."
              options={[
                { value: 'waiter', label: 'Waiter' },
                { value: 'chef', label: 'Chef' },
                { value: 'barista', label: 'Barista' },
              ]}
            />
            <Select
              label="Error"
              hasError
              errorMessage="Please select a role"
              placeholder="Select role..."
              options={[
                { value: 'waiter', label: 'Waiter' },
                { value: 'chef', label: 'Chef' },
              ]}
            />
          </div>
        </Section>

        {/* 13. Toggle */}
        <Section title="13. Toggle">
          <Row>
            <Toggle checked={false} onChange={() => {}} />
            <Toggle checked={true} onChange={() => {}} />
            <Toggle checked={toggleOn} onChange={setToggleOn} label={toggleOn ? 'Available' : 'Unavailable'} />
            <Toggle checked={false} onChange={() => {}} disabled label="Disabled" />
          </Row>
        </Section>

        {/* 14. FormField */}
        <Section title="14. FormField">
          <div className="max-w-sm space-y-4">
            <FormField label="Staff Name" htmlFor="staff-name" required helperText="Enter full name as on ID">
              <Input id="staff-name" placeholder="e.g. James Mwangi" />
            </FormField>
            <FormField label="Phone Number" htmlFor="phone" errorMessage="Invalid phone number">
              <Input id="phone" defaultValue="07abc" />
            </FormField>
          </div>
        </Section>

        {/* 15. DatePicker + TimePicker */}
        <Section title="15. DatePicker + TimePicker">
          <Row>
            <DatePicker label="Select Date" value={dateVal} onChange={setDateVal} className="w-64" />
            <TimePicker label="Select Time" value={timeVal} onChange={setTimeVal} className="w-48" />
          </Row>
        </Section>

        {/* 16. Card */}
        <Section title="16. Card">
          <div className="max-w-sm">
            <Card>
              <CardHeader>
                <h3 className="text-heading-sm font-semibold text-stone-900">Card Header</h3>
              </CardHeader>
              <CardBody>
                <p className="text-body-md text-stone-700">This is the card body with some content to demonstrate the layout.</p>
              </CardBody>
              <CardFooter>
                <Row>
                  <Button variant="secondary" size="sm">Cancel</Button>
                  <Button size="sm">Save</Button>
                </Row>
              </CardFooter>
            </Card>
          </div>
        </Section>

        {/* 17. StatCard */}
        <Section title="17. StatCard">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard value="KES 48,200" label="Revenue Today" icon={<BarChart2 size={20} />} caption="↑ 12% vs yesterday" />
            <StatCard value="34" label="Orders Today" icon={<ShoppingCart size={20} />} />
            <StatCard value="8 min" label="Avg Prep Time" icon={<Clock size={20} />} />
            <StatCard value="6" label="Staff on Shift" icon={<Users size={20} />} />
          </div>
        </Section>

        {/* 18. OrderCard */}
        <Section title="18. OrderCard">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orderStatuses.map((status) => (
              <OrderCard
                key={status}
                orderNumber={7}
                status={status}
                type="DINE_IN"
                tableNumber="4"
                startTime={normalStart}
                onTap={() => toast({ variant: 'info', title: `Tapped order #7 (${status})` })}
              />
            ))}
          </div>
        </Section>

        {/* 19. KDSCard */}
        <Section title="19. KDSCard">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KDSCard
              orderNumber={12}
              type="DINE_IN"
              tableNumber="3"
              items={kdsItems}
              startTime={normalStart}
              status="PENDING"
              actionLabel="Claim Order"
              onAction={() => toast({ variant: 'success', title: 'Order #12 claimed' })}
            />
            <KDSCard
              orderNumber={5}
              type="TAKE_AWAY"
              items={kdsItems}
              specialInstructions="No sugar in the flat white please"
              startTime={lateStart}
              status="IN_PROGRESS"
              actionLabel="Mark Ready"
              onAction={() => toast({ variant: 'success', title: 'Order #5 marked ready' })}
            />
          </div>
        </Section>

        {/* 20. MenuItemCard */}
        <Section title="20. MenuItemCard">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <MenuItemCard
              name="Flat White"
              description="A smooth, velvety espresso with steamed whole milk. Our signature drink."
              price={350}
              isAvailable
              onAdd={() => toast({ variant: 'success', title: 'Flat White added to cart' })}
            />
            <MenuItemCard
              name="Avocado Toast"
              description="Sourdough toast with smashed avocado, cherry tomatoes, and a poached egg."
              price={650}
              isAvailable
              onAdd={() => {}}
            />
            <MenuItemCard
              name="Seasonal Juice"
              description="Fresh pressed juice from seasonal fruits."
              price={280}
              isAvailable={false}
            />
          </div>
          <p className="text-caption text-stone-500 mt-3">Cards without <code>imageUrl</code> show a placeholder. Pass <code>imageUrl</code> to display food photography.</p>
        </Section>

        {/* 21. StaffCard */}
        <Section title="21. StaffCard">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <StaffCard name="James Mwangi" role="Waiter" isActive />
            <StaffCard name="Wanjiru Kamau" role="Chef" isActive />
            <StaffCard name="Peter Ochieng" role="Barista" isActive={false} />
          </div>
        </Section>

        {/* 22. Modal */}
        <Section title="22. Modal">
          <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Create Staff Account"
            footer={
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button onClick={() => { setModalOpen(false); toast({ variant: 'success', title: 'Staff account created' }) }}>
                  Save
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <Input label="Full Name" placeholder="e.g. James Mwangi" />
              <Input label="Email" placeholder="james@wendo.co.ke" />
              <Select
                label="Role"
                placeholder="Select role..."
                options={[
                  { value: 'waiter', label: 'Waiter' },
                  { value: 'chef', label: 'Chef' },
                  { value: 'barista', label: 'Barista' },
                ]}
              />
            </div>
          </Modal>
        </Section>

        {/* 23. BottomSheet */}
        <Section title="23. BottomSheet">
          <Button onClick={() => setSheetOpen(true)}>Open Bottom Sheet</Button>
          <BottomSheet
            isOpen={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Order #7 Details"
          >
            <div className="space-y-3 py-2">
              <p className="text-body-md text-stone-700">2× Flat White — KES 700</p>
              <p className="text-body-md text-stone-700">1× Avocado Toast — KES 650</p>
              <Divider />
              <p className="text-label-lg font-semibold text-stone-900">Total: KES 1,350</p>
              <Button className="w-full mt-4" onClick={() => { setSheetOpen(false); toast({ variant: 'success', title: 'Payment recorded' }) }}>
                Record Payment
              </Button>
            </div>
          </BottomSheet>
        </Section>

        {/* 24. Popover */}
        <Section title="24. Popover">
          <Row>
            <Popover
              trigger={<Button variant="secondary">Export Options</Button>}
            >
              <div className="py-1">
                <button className="w-full text-left px-4 py-2 text-body-sm text-stone-700 hover:bg-stone-100 transition-colors">
                  Export as PDF
                </button>
                <button className="w-full text-left px-4 py-2 text-body-sm text-stone-700 hover:bg-stone-100 transition-colors">
                  Export as CSV
                </button>
              </div>
            </Popover>
          </Row>
        </Section>

        {/* 25. ConfirmDialog */}
        <Section title="25. ConfirmDialog">
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Deactivate Staff Member
          </Button>
          <ConfirmDialog
            isOpen={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={handleConfirm}
            title="Deactivate Staff Member"
            description="This will prevent James Mwangi from logging in. You can reactivate them at any time."
            confirmLabel="Deactivate"
            isLoading={confirmLoading}
          />
        </Section>

        {/* 26. Toast */}
        <Section title="26. Toast System">
          <Row>
            <Button
              variant="primary"
              onClick={() => toast({ variant: 'success', title: 'Order #7 sent to the kitchen', message: 'Dine-In · Table 4' })}
            >
              Success Toast
            </Button>
            <Button
              variant="destructive"
              onClick={() => toast({ variant: 'error', title: 'Failed to create order', message: 'Check your connection and try again.' })}
            >
              Error Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast({ variant: 'warning', title: 'Menu cache is stale', message: 'Some items may not reflect latest prices.' })}
            >
              Warning Toast
            </Button>
            <Button
              variant="ghost"
              onClick={() => toast({ variant: 'info', title: 'New feature available', message: 'Delivery zones have been updated.' })}
            >
              Info Toast
            </Button>
          </Row>
          <p className="text-caption text-stone-500 mt-3">Success and info auto-dismiss in 4s. Warning in 6s. Error requires manual close.</p>
        </Section>

        {/* 27. EmptyState */}
        <Section title="27. EmptyState">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-stone-200 rounded-md">
              <EmptyState
                icon={<Inbox size={48} />}
                heading="No orders yet today"
                body="Nothing yet — the day is just getting started."
                action={<Button size="sm">Create Order</Button>}
              />
            </div>
            <div className="bg-white border border-stone-200 rounded-md">
              <EmptyState
                icon={<Calendar size={48} />}
                heading="No upcoming shifts"
                body="No shifts scheduled for the next 7 days."
              />
            </div>
          </div>
        </Section>

        {/* 28. Skeleton Components */}
        <Section title="28. Skeleton Loading States">
          <div className="space-y-6">
            <div>
              <p className="text-label-sm text-stone-500 mb-3">SkeletonBlock — various sizes</p>
              <div className="space-y-2 max-w-md">
                <SkeletonBlock height="h-6" width="w-1/3" />
                <SkeletonBlock height="h-4" width="w-full" />
                <SkeletonBlock height="h-4" width="w-4/5" />
                <SkeletonBlock height="h-4" width="w-2/3" />
              </div>
            </div>
            <div>
              <p className="text-label-sm text-stone-500 mb-3">SkeletonCard</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            </div>
            <div>
              <p className="text-label-sm text-stone-500 mb-3">SkeletonTable</p>
              <SkeletonTable rows={4} columns={4} />
            </div>
          </div>
        </Section>

        {/* 29. Table */}
        <Section title="29. Table">
          <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
            <Table<SampleRow>
              columns={tableColumns}
              data={sampleTableData}
              keyField="id"
            />
          </div>
          <div className="mt-4 bg-white border border-stone-200 rounded-md overflow-hidden">
            <p className="text-label-sm text-stone-500 px-4 pt-3 mb-1">Empty state:</p>
            <Table<SampleRow>
              columns={tableColumns}
              data={[]}
              keyField="id"
              emptyState={
                <EmptyState
                  icon={<AlertCircle size={48} />}
                  heading="No staff found"
                  body="Add staff to your branch to see them here."
                />
              }
            />
          </div>
        </Section>

        {/* 30. Navigation Previews */}
        <Section title="30. Navigation Components">
          <div className="space-y-6">
            {/* BottomNav preview */}
            <div>
              <p className="text-label-sm text-stone-500 mb-3">BottomNav (mobile)</p>
              <div className="max-w-sm border border-stone-200 rounded-md overflow-hidden">
                <BottomNav
                  tabs={[
                    { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
                    { label: 'Orders', href: '/app/orders', icon: ShoppingCart },
                    { label: 'Shifts', href: '/app/shifts', icon: Calendar },
                    { label: 'Profile', href: '/app/profile', icon: UserCircle },
                  ]}
                  activeHref="/app/orders"
                />
              </div>
            </div>

            {/* SidebarNav preview */}
            <div>
              <p className="text-label-sm text-stone-500 mb-3">SidebarNav (desktop)</p>
              <div className="w-60 border border-stone-200 rounded-md overflow-hidden bg-white h-64">
                <SidebarNav
                  sections={[
                    {
                      items: [{ label: 'Dashboard', href: '/app/manage/dashboard', icon: LayoutDashboard }],
                    },
                    {
                      label: 'Manage',
                      items: [
                        { label: 'Staff', href: '/app/manage/staff', icon: Users },
                        { label: 'Menu', href: '/app/manage/menu', icon: ChefHat },
                        { label: 'Reports', href: '/app/manage/reports', icon: BarChart2 },
                      ],
                    },
                  ]}
                  activeHref="/app/manage/staff"
                />
              </div>
            </div>

            {/* TopBar preview */}
            <div>
              <p className="text-label-sm text-stone-500 mb-3">TopBar (KDS/BDS)</p>
              <div className="rounded-md overflow-hidden">
                <TopBar branchName="Nyeri Branch" connectionStatus="connected" />
              </div>
            </div>
          </div>
        </Section>

        <div className="pb-16 text-center text-caption text-stone-400">
          End of component catalogue — Phase 1.5 complete
        </div>
      </div>
    </div>
  )
}
