path = "C:/Users/KKF/Projects/g4m37z-communities/src/app/signup/page.tsx"
with open(path) as f: c = f.read()
print("signup mobile layout present:", "min-h-[80vh]" in c)
# Standardize radius on signup card
c = c.replace("rounded-2xl border border-border bg-bg p-6 sm:p-8", "rounded-lg border border-border bg-surface p-6 sm:p-8")
with open(path, "w") as f: f.write(c)
print("signup radius standardized")
