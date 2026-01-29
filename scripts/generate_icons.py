"""
Script to generate PNG icons for PWA/APK from SVG
Requires: pip install cairosvg pillow
"""

import os
import sys

# Try different methods to generate icons
def generate_icons_cairosvg():
    """Generate using cairosvg (best quality)"""
    try:
        import cairosvg
        from PIL import Image
        import io
        
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        images_dir = os.path.join(base_dir, 'pwa', 'images')
        
        # Read SVG content
        svg_512_path = os.path.join(images_dir, 'icon-512.svg')
        
        with open(svg_512_path, 'r') as f:
            svg_content = f.read()
        
        sizes = [192, 512]
        
        for size in sizes:
            # Regular icon
            png_data = cairosvg.svg2png(bytestring=svg_content.encode(), 
                                         output_width=size, 
                                         output_height=size)
            
            output_path = os.path.join(images_dir, f'icon-{size}.png')
            with open(output_path, 'wb') as f:
                f.write(png_data)
            print(f"Created: {output_path}")
            
            # Maskable icon (with padding for safe zone)
            # Android maskable icons need 10% padding
            canvas_size = size
            icon_size = int(size * 0.8)  # 80% of canvas for safe zone
            padding = (canvas_size - icon_size) // 2
            
            png_data = cairosvg.svg2png(bytestring=svg_content.encode(),
                                         output_width=icon_size,
                                         output_height=icon_size)
            
            # Create canvas with background
            img = Image.open(io.BytesIO(png_data))
            canvas = Image.new('RGBA', (canvas_size, canvas_size), (127, 13, 242, 255))  # Primary color
            canvas.paste(img, (padding, padding), img if img.mode == 'RGBA' else None)
            
            maskable_path = os.path.join(images_dir, f'icon-maskable-{size}.png')
            canvas.save(maskable_path, 'PNG')
            print(f"Created: {maskable_path}")
        
        return True
    except ImportError as e:
        print(f"cairosvg not available: {e}")
        return False

def generate_icons_pillow_only():
    """Generate simple icons using Pillow only (fallback)"""
    try:
        from PIL import Image, ImageDraw
        
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        images_dir = os.path.join(base_dir, 'pwa', 'images')
        
        sizes = [192, 512]
        
        # Miru brand colors
        primary_color = (127, 13, 242)  # #7f0df2
        secondary_color = (88, 28, 135)  # #581c87
        white = (255, 255, 255)
        
        for size in sizes:
            # Create gradient-like background
            img = Image.new('RGB', (size, size), primary_color)
            draw = ImageDraw.Draw(img)
            
            # Draw a simple gradient circle
            center = size // 2
            for r in range(center, 0, -1):
                # Gradient from primary to secondary
                ratio = r / center
                color = tuple(int(primary_color[i] * ratio + secondary_color[i] * (1 - ratio)) for i in range(3))
                draw.ellipse([center - r, center - r, center + r, center + r], fill=color)
            
            # Draw "M" letter
            font_size = size // 3
            letter_x = center - font_size // 3
            letter_y = center - font_size // 2
            
            # Simple M shape using lines
            m_width = size // 3
            m_height = size // 3
            m_x = center - m_width // 2
            m_y = center - m_height // 2
            
            # Draw M
            line_width = max(size // 20, 3)
            draw.line([(m_x, m_y + m_height), (m_x, m_y)], fill=white, width=line_width)
            draw.line([(m_x, m_y), (center, m_y + m_height // 2)], fill=white, width=line_width)
            draw.line([(center, m_y + m_height // 2), (m_x + m_width, m_y)], fill=white, width=line_width)
            draw.line([(m_x + m_width, m_y), (m_x + m_width, m_y + m_height)], fill=white, width=line_width)
            
            # Save regular icon
            output_path = os.path.join(images_dir, f'icon-{size}.png')
            img.save(output_path, 'PNG')
            print(f"Created: {output_path}")
            
            # Maskable version with more padding
            canvas_size = size
            icon_size = int(size * 0.8)
            padding = (canvas_size - icon_size) // 2
            
            maskable = Image.new('RGB', (canvas_size, canvas_size), primary_color)
            # Resize and center
            small_img = img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
            maskable.paste(small_img, (padding, padding))
            
            maskable_path = os.path.join(images_dir, f'icon-maskable-{size}.png')
            maskable.save(maskable_path, 'PNG')
            print(f"Created: {maskable_path}")
        
        return True
    except Exception as e:
        print(f"Pillow generation failed: {e}")
        return False

if __name__ == '__main__':
    print("Generating PWA icons for Miru...")
    
    # Try cairosvg first (best quality)
    if not generate_icons_cairosvg():
        print("\nFalling back to Pillow-only generation...")
        if not generate_icons_pillow_only():
            print("\nERROR: Could not generate icons!")
            print("Please install required packages:")
            print("  pip install cairosvg pillow")
            sys.exit(1)
    
    print("\nIcons generated successfully!")
