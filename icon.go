package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"math"
	"runtime"
)

// The tray icon is a TOML table header, [•], drawn at startup so that no image
// files are needed.

const iconSize = 64

var (
	black = color.NRGBA{0, 0, 0, 255}
	white = color.NRGBA{255, 255, 255, 255}
	blue  = color.NRGBA{59, 111, 240, 255}
)

// templateIcon is black on transparent, so macOS can adapt it to light and dark menu bars.
func templateIcon() []byte {
	return encodePNG(render(
		layer{brackets(1), black},
		layer{circle(32, 32, 6.5), black},
	))
}

// colorIcon is used where template icons are not supported.
func colorIcon() []byte {
	data := encodePNG(render(
		layer{roundedBox(32, 32, 32, 32, 14), blue},
		layer{brackets(0.68), white},
		layer{circle(32, 32, 4.4), white},
	))
	if runtime.GOOS == "windows" {
		return wrapICO(data)
	}
	return data
}

// distance returns the signed distance from a point to a shape edge.
type distance func(x, y float64) float64

type layer struct {
	shape distance
	color color.NRGBA
}

func roundedBox(cx, cy, halfW, halfH, radius float64) distance {
	return func(x, y float64) float64 {
		qx := math.Abs(x-cx) - (halfW - radius)
		qy := math.Abs(y-cy) - (halfH - radius)
		outside := math.Hypot(math.Max(qx, 0), math.Max(qy, 0))
		inside := math.Min(math.Max(qx, qy), 0)
		return outside + inside - radius
	}
}

// brackets draws [ and ], scaled around the center of the icon.
func brackets(scale float64) distance {
	at := func(v float64) float64 { return 32 + (v-32)*scale }
	box := func(cx, cy, halfW, halfH float64) distance {
		return roundedBox(at(cx), at(cy), halfW*scale, halfH*scale, 1.5*scale)
	}
	return union(
		box(17, 32, 3, 19), box(21, 16, 7, 3), box(21, 48, 7, 3),
		box(47, 32, 3, 19), box(43, 16, 7, 3), box(43, 48, 7, 3),
	)
}

func union(shapes ...distance) distance {
	return func(x, y float64) float64 {
		d := math.Inf(1)
		for _, shape := range shapes {
			d = math.Min(d, shape(x, y))
		}
		return d
	}
}

func circle(cx, cy, radius float64) distance {
	return func(x, y float64) float64 {
		return math.Hypot(x-cx, y-cy) - radius
	}
}

func ring(shape distance, halfWidth float64) distance {
	return func(x, y float64) float64 {
		return math.Abs(shape(x, y)) - halfWidth
	}
}

func render(layers ...layer) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, iconSize, iconSize))
	for y := range iconSize {
		for x := range iconSize {
			var r, g, b, a float64
			for _, l := range layers {
				coverage := math.Max(0, math.Min(1, 0.5-l.shape(float64(x)+0.5, float64(y)+0.5)))
				alpha := coverage * float64(l.color.A) / 255
				r = float64(l.color.R)*alpha + r*(1-alpha)
				g = float64(l.color.G)*alpha + g*(1-alpha)
				b = float64(l.color.B)*alpha + b*(1-alpha)
				a = alpha + a*(1-alpha)
			}
			if a > 0 {
				img.SetNRGBA(x, y, color.NRGBA{uint8(r / a), uint8(g / a), uint8(b / a), uint8(a * 255)})
			}
		}
	}
	return img
}

func encodePNG(img image.Image) []byte {
	var buf bytes.Buffer
	png.Encode(&buf, img)
	return buf.Bytes()
}

// wrapICO puts a PNG inside an ICO container, which Windows accepts since Vista.
func wrapICO(data []byte) []byte {
	var buf bytes.Buffer
	header := []any{
		uint16(0), uint16(1), uint16(1),
		uint8(iconSize), uint8(iconSize), uint8(0), uint8(0),
		uint16(1), uint16(32), uint32(len(data)), uint32(22),
	}
	for _, field := range header {
		binary.Write(&buf, binary.LittleEndian, field)
	}
	buf.Write(data)
	return buf.Bytes()
}
