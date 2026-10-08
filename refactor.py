import os
import re

def process_file(path):
    with open(path, 'r') as f:
        content = f.read()

    # AuthLayout.tsx specific
    if 'AuthLayout.tsx' in path:
        content = re.sub(r'import \{ motion, AnimatePresence \} from "framer-motion";\n?', '', content)
        # Add mounted state
        if 'const [mounted, setMounted] = useState(false);' not in content:
            content = content.replace(
                'const [currentImage, setCurrentImage] = useState(0);',
                'const [currentImage, setCurrentImage] = useState(0);\n  const [mounted, setMounted] = useState(false);'
            )
            content = content.replace(
                'useEffect(() => {\n    const timer = setInterval(() => {',
                'useEffect(() => {\n    setMounted(true);\n    const timer = setInterval(() => {'
            )
            content = content.replace(
                'useEffect(() => {\n  const timer = setInterval(() => {',
                'useEffect(() => {\n  setMounted(true);\n  const timer = setInterval(() => {'
            )

        # Replace AnimatePresence block
        bg_pattern = r'<AnimatePresence initial=\{false\}>[\s\S]*?</AnimatePresence>'
        replacement = """{IMAGES.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 z-0 transition-all duration-[1500ms] ease-in-out ${
              index === currentImage ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-cover"
              priority={index === 0}
            />
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </div>
        ))}"""
        content = re.sub(bg_pattern, replacement, content)

        # Replace motion.div for MaskedHeading
        heading_pattern = r'<motion\.div\s+initial=\{[\s\S]*?className="([^"]+)"\s*>'
        content = re.sub(heading_pattern, r'<div className="\1 transition-all duration-700 ${mounted ? \'translate-y-0 opacity-100\' : \'translate-y-5 opacity-0\'}">', content)
        content = content.replace('</motion.div>', '</div>')

        # Replace motion.p
        p_pattern = r'<motion\.p\s+initial=\{[\s\S]*?className="([^"]+)"\s*>'
        content = re.sub(p_pattern, r'<p className="\1 transition-all duration-700 delay-200 ${mounted ? \'translate-y-0 opacity-100\' : \'translate-y-5 opacity-0\'}">', content)
        content = content.replace('</motion.p>', '</p>')

    # ModernLoginForm.tsx specific
    if 'ModernLoginForm.tsx' in path:
        content = re.sub(r'import \{ motion, AnimatePresence \} from "framer-motion";\n?', '', content)
        content = re.sub(r'const formVariants = \{[\s\S]*?\};\n\n', '', content)
        content = content.replace('<AnimatePresence custom={direction} mode="wait">', '')
        content = content.replace('</AnimatePresence>', '')
        
        # Replace motion.div
        motion_div = r'<motion\.div\s+key="login"\s+custom=\{direction\}\s+variants=\{formVariants\}\s+initial="enter"\s+animate="center"\s+exit="exit"\s+transition=\{[^}]+\}\s+className="([^"]+)"\s*>'
        content = re.sub(motion_div, r'<div className="\1 animate-in fade-in zoom-in-95 duration-300">', content)
        content = content.replace('</motion.div>', '</div>')

        # Replace motion.form
        motion_form = r'<motion\.form\s+key="([^"]+)"\s+ref=\{([^}]+)\}\s+onSubmit=\{([^}]+)\}\s+custom=\{direction\}\s+variants=\{formVariants\}\s+initial="enter"\s+animate="center"\s+exit="exit"\s+transition=\{[^}]+\}\s+className="([^"]+)"\s*>'
        content = re.sub(motion_form, r'<form ref={\2} onSubmit={\3} className="\4 animate-in fade-in zoom-in-95 duration-300">', content)
        content = content.replace('</motion.form>', '</form>')

        # Replace motion.button
        motion_btn = r'<motion\.button\s+whileHover=\{\{[^}]+\}\}\s+whileTap=\{\{[^}]+\}\}\s+type="([^"]+)"\s+disabled=\{([^}]+)\}\s+className="([^"]+)"\s*>'
        content = re.sub(motion_btn, r'<button type="\1" disabled={\2} className="\3 hover:scale-[1.01] active:scale-[0.98]">', content)
        content = content.replace('</motion.button>', '</button>')
        
        # Cleanup any unused direction variable and changeMode usage
        # Actually direction state can just be removed or left alone since it's harmless, but let's keep it minimal
        
    # ModernRegisterForm.tsx specific
    if 'ModernRegisterForm.tsx' in path:
        content = re.sub(r'import \{ motion, AnimatePresence \} from "framer-motion";\n?', '', content)
        content = re.sub(r'const formVariants = \{[\s\S]*?\};\n\n', '', content)
        content = content.replace('<AnimatePresence custom={direction} mode="wait">', '')
        content = content.replace('</AnimatePresence>', '')
        
        # Replace motion.form
        motion_form = r'<motion\.form\s+key="([^"]+)"\s+action=\{([^}]+)\}\s+custom=\{direction\}\s+variants=\{formVariants\}\s+initial="enter"\s+animate="center"\s+exit="exit"\s+transition=\{[^}]+\}\s+className="([^"]+)"\s*>'
        content = re.sub(motion_form, r'<form action={\2} className="\3 animate-in fade-in zoom-in-95 duration-300">', content)
        content = content.replace('</motion.form>', '</form>')

        # Replace motion.button
        motion_btn = r'<motion\.button\s+whileHover=\{\{[^}]+\}\}\s+whileTap=\{\{[^}]+\}\}\s+type="([^"]+)"\s+disabled=\{([^}]+)\}\s+className="([^"]+)"\s*>'
        content = re.sub(motion_btn, r'<button type="\1" disabled={\2} className="\3 hover:scale-[1.01] active:scale-[0.98]">', content)
        content = content.replace('</motion.button>', '</button>')

    with open(path, 'w') as f:
        f.write(content)

process_file("apps/web-user/components/features/auth/AuthLayout.tsx")
process_file("apps/web-user/components/features/auth/ModernLoginForm.tsx")
process_file("apps/web-user/components/features/auth/ModernRegisterForm.tsx")

