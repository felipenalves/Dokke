import SwiftUI

// Provider glyph geometry adapted from Codenotch's ProviderGlyph/GlyphOutline.
// Source: https://github.com/vinzdg/codenotch
// Copyright (c) 2026 Vinz.
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// The outlines are kept as vectors instead of SF Symbols so the provider marks
// remain the same at every size and match the reference settings UI.
enum ProviderGlyph {
  case claude
  case openai
  case antigravity
  case grok

  var opticalScale: CGFloat {
    switch self {
    case .claude: return 0.97
    case .openai: return 0.94
    case .antigravity: return 1.0
    case .grok: return 1.0
    }
  }

  var outline: [[CGPoint]] {
    switch self {
    case .claude: return CodenotchGlyphOutline.claude
    case .openai: return CodenotchGlyphOutline.openai
    case .antigravity: return CodenotchGlyphOutline.antigravity
    case .grok: return CodenotchGlyphOutline.grok
    }
  }
}

extension UsageProviderOrder {
  var providerGlyph: ProviderGlyph {
    switch self {
    case .claude: return .claude
    case .codex: return .openai
    case .antigravity: return .antigravity
    case .grok: return .grok
    }
  }
}

enum CodenotchGlyphOutline {
  static let claude: [[CGPoint]] = [
        [CGPoint(x: 0.2879, y: 0.0108), CGPoint(x: 0.2667, y: 0.0223), CGPoint(x: 0.2423, y: 0.0516),
         CGPoint(x: 0.2427, y: 0.0873), CGPoint(x: 0.2611, y: 0.1275), CGPoint(x: 0.3425, y: 0.2606),
         CGPoint(x: 0.3879, y: 0.3474), CGPoint(x: 0.3888, y: 0.3670), CGPoint(x: 0.3695, y: 0.3643),
         CGPoint(x: 0.2014, y: 0.2351), CGPoint(x: 0.1878, y: 0.2200), CGPoint(x: 0.1552, y: 0.1998),
         CGPoint(x: 0.1253, y: 0.1950), CGPoint(x: 0.1111, y: 0.1995), CGPoint(x: 0.0877, y: 0.2258),
         CGPoint(x: 0.0887, y: 0.2565), CGPoint(x: 0.0953, y: 0.2714), CGPoint(x: 0.1180, y: 0.2961),
         CGPoint(x: 0.1661, y: 0.3284), CGPoint(x: 0.1791, y: 0.3426), CGPoint(x: 0.2965, y: 0.4155),
         CGPoint(x: 0.3095, y: 0.4297), CGPoint(x: 0.3940, y: 0.4803), CGPoint(x: 0.3974, y: 0.4946),
         CGPoint(x: 0.3767, y: 0.5004), CGPoint(x: 0.2177, y: 0.4830), CGPoint(x: 0.0404, y: 0.4741),
         CGPoint(x: 0.0186, y: 0.4808), CGPoint(x: 0.0129, y: 0.4990), CGPoint(x: 0.0276, y: 0.5245),
         CGPoint(x: 0.0649, y: 0.5375), CGPoint(x: 0.3801, y: 0.5449), CGPoint(x: 0.3943, y: 0.5488),
         CGPoint(x: 0.3979, y: 0.5574), CGPoint(x: 0.3773, y: 0.5800), CGPoint(x: 0.3130, y: 0.6116),
         CGPoint(x: 0.2589, y: 0.6470), CGPoint(x: 0.2341, y: 0.6564), CGPoint(x: 0.1360, y: 0.7209),
         CGPoint(x: 0.1142, y: 0.7485), CGPoint(x: 0.1149, y: 0.7681), CGPoint(x: 0.1416, y: 0.7866),
         CGPoint(x: 0.1912, y: 0.7787), CGPoint(x: 0.4120, y: 0.6320), CGPoint(x: 0.4270, y: 0.6288),
         CGPoint(x: 0.4321, y: 0.6332), CGPoint(x: 0.4292, y: 0.6454), CGPoint(x: 0.3940, y: 0.6799),
         CGPoint(x: 0.3428, y: 0.7530), CGPoint(x: 0.2416, y: 0.8771), CGPoint(x: 0.2334, y: 0.9073),
         CGPoint(x: 0.2403, y: 0.9269), CGPoint(x: 0.2558, y: 0.9336), CGPoint(x: 0.2734, y: 0.9308),
         CGPoint(x: 0.3431, y: 0.8618), CGPoint(x: 0.4700, y: 0.6899), CGPoint(x: 0.4807, y: 0.6667),
         CGPoint(x: 0.4915, y: 0.6611), CGPoint(x: 0.5001, y: 0.6669), CGPoint(x: 0.4995, y: 0.6906),
         CGPoint(x: 0.4474, y: 0.9569), CGPoint(x: 0.4618, y: 0.9946), CGPoint(x: 0.4901, y: 1.0070),
         CGPoint(x: 0.5162, y: 0.9945), CGPoint(x: 0.5228, y: 0.9833), CGPoint(x: 0.5369, y: 0.9018),
         CGPoint(x: 0.5520, y: 0.7109), CGPoint(x: 0.5593, y: 0.6981), CGPoint(x: 0.5814, y: 0.7096),
         CGPoint(x: 0.6328, y: 0.7971), CGPoint(x: 0.7227, y: 0.9242), CGPoint(x: 0.7395, y: 0.9333),
         CGPoint(x: 0.7662, y: 0.9315), CGPoint(x: 0.7775, y: 0.9241), CGPoint(x: 0.7830, y: 0.9106),
         CGPoint(x: 0.7785, y: 0.8597), CGPoint(x: 0.6882, y: 0.7238), CGPoint(x: 0.6753, y: 0.7115),
         CGPoint(x: 0.6765, y: 0.6956), CGPoint(x: 0.6875, y: 0.6957), CGPoint(x: 0.7252, y: 0.7339),
         CGPoint(x: 0.8721, y: 0.8489), CGPoint(x: 0.8842, y: 0.8515), CGPoint(x: 0.8959, y: 0.8468),
         CGPoint(x: 0.9038, y: 0.8373), CGPoint(x: 0.9046, y: 0.8256), CGPoint(x: 0.8530, y: 0.7662),
         CGPoint(x: 0.6984, y: 0.6269), CGPoint(x: 0.6775, y: 0.6016), CGPoint(x: 0.6778, y: 0.5933),
         CGPoint(x: 0.6885, y: 0.5908), CGPoint(x: 0.8106, y: 0.6247), CGPoint(x: 0.9440, y: 0.6533),
         CGPoint(x: 0.9782, y: 0.6467), CGPoint(x: 1.0094, y: 0.6185), CGPoint(x: 0.9968, y: 0.5927),
         CGPoint(x: 0.9637, y: 0.5647), CGPoint(x: 0.8743, y: 0.5599), CGPoint(x: 0.8332, y: 0.5528),
         CGPoint(x: 0.7469, y: 0.5529), CGPoint(x: 0.7252, y: 0.5475), CGPoint(x: 0.7138, y: 0.5382),
         CGPoint(x: 0.7174, y: 0.5299), CGPoint(x: 0.7308, y: 0.5244), CGPoint(x: 0.9772, y: 0.4740),
         CGPoint(x: 0.9904, y: 0.4655), CGPoint(x: 0.9985, y: 0.4514), CGPoint(x: 1.0037, y: 0.4324),
         CGPoint(x: 1.0001, y: 0.4183), CGPoint(x: 0.9889, y: 0.4107), CGPoint(x: 0.9616, y: 0.4064),
         CGPoint(x: 0.8604, y: 0.4200), CGPoint(x: 0.7578, y: 0.4394), CGPoint(x: 0.7164, y: 0.4523),
         CGPoint(x: 0.7010, y: 0.4468), CGPoint(x: 0.7391, y: 0.3769), CGPoint(x: 0.8619, y: 0.2207),
         CGPoint(x: 0.8733, y: 0.1749), CGPoint(x: 0.8678, y: 0.1520), CGPoint(x: 0.8528, y: 0.1331),
         CGPoint(x: 0.8338, y: 0.1217), CGPoint(x: 0.8169, y: 0.1215), CGPoint(x: 0.7888, y: 0.1313),
         CGPoint(x: 0.7199, y: 0.2007), CGPoint(x: 0.6224, y: 0.3290), CGPoint(x: 0.6034, y: 0.3517),
         CGPoint(x: 0.5941, y: 0.3541), CGPoint(x: 0.5878, y: 0.3448), CGPoint(x: 0.5875, y: 0.3285),
         CGPoint(x: 0.6249, y: 0.1713), CGPoint(x: 0.6378, y: 0.0744), CGPoint(x: 0.6253, y: 0.0430),
         CGPoint(x: 0.6043, y: 0.0257), CGPoint(x: 0.5890, y: 0.0265), CGPoint(x: 0.5661, y: 0.0463),
         CGPoint(x: 0.5471, y: 0.0805), CGPoint(x: 0.5369, y: 0.2279), CGPoint(x: 0.5259, y: 0.2877),
         CGPoint(x: 0.5223, y: 0.3461), CGPoint(x: 0.5165, y: 0.3730), CGPoint(x: 0.5080, y: 0.3786),
         CGPoint(x: 0.4728, y: 0.2909), CGPoint(x: 0.3941, y: 0.1409), CGPoint(x: 0.3647, y: 0.0645),
         CGPoint(x: 0.3439, y: 0.0282), CGPoint(x: 0.3305, y: 0.0183), CGPoint(x: 0.3013, y: 0.0095),
         CGPoint(x: 0.2880, y: 0.0108)],
    ]
    static let openai: [[CGPoint]] = [
        [CGPoint(x: 0.4234, y: -0.0272), CGPoint(x: 0.3541, y: -0.0187), CGPoint(x: 0.3013, y: 0.0040),
         CGPoint(x: 0.2422, y: 0.0495), CGPoint(x: 0.2012, y: 0.1069), CGPoint(x: 0.1823, y: 0.1455),
         CGPoint(x: 0.1435, y: 0.1661), CGPoint(x: 0.1104, y: 0.1756), CGPoint(x: 0.0468, y: 0.2232),
         CGPoint(x: 0.0013, y: 0.2863), CGPoint(x: -0.0216, y: 0.3430), CGPoint(x: -0.0275, y: 0.4147),
         CGPoint(x: -0.0212, y: 0.4800), CGPoint(x: 0.0021, y: 0.5354), CGPoint(x: 0.0380, y: 0.5897),
         CGPoint(x: 0.0271, y: 0.6302), CGPoint(x: 0.0242, y: 0.6634), CGPoint(x: 0.0281, y: 0.7123),
         CGPoint(x: 0.0453, y: 0.7686), CGPoint(x: 0.0889, y: 0.8376), CGPoint(x: 0.1131, y: 0.8638),
         CGPoint(x: 0.1823, y: 0.9074), CGPoint(x: 0.2413, y: 0.9266), CGPoint(x: 0.3060, y: 0.9300),
         CGPoint(x: 0.3346, y: 0.9264), CGPoint(x: 0.3516, y: 0.9307), CGPoint(x: 0.4021, y: 0.9710),
         CGPoint(x: 0.4298, y: 0.9808), CGPoint(x: 0.4562, y: 0.9973), CGPoint(x: 0.5234, y: 1.0093),
         CGPoint(x: 0.5785, y: 1.0094), CGPoint(x: 0.6468, y: 0.9924), CGPoint(x: 0.7148, y: 0.9513),
         CGPoint(x: 0.7772, y: 0.8832), CGPoint(x: 0.8042, y: 0.8303), CGPoint(x: 0.8365, y: 0.8205),
         CGPoint(x: 0.8821, y: 0.7975), CGPoint(x: 0.9458, y: 0.7449), CGPoint(x: 0.9740, y: 0.7075),
         CGPoint(x: 0.9957, y: 0.6627), CGPoint(x: 1.0095, y: 0.5968), CGPoint(x: 1.0090, y: 0.5479),
         CGPoint(x: 0.9945, y: 0.4764), CGPoint(x: 0.9451, y: 0.3970), CGPoint(x: 0.9551, y: 0.3353),
         CGPoint(x: 0.9516, y: 0.2607), CGPoint(x: 0.9295, y: 0.1997), CGPoint(x: 0.8836, y: 0.1329),
         CGPoint(x: 0.8279, y: 0.0900), CGPoint(x: 0.7854, y: 0.0679), CGPoint(x: 0.7109, y: 0.0532),
         CGPoint(x: 0.6410, y: 0.0590), CGPoint(x: 0.6009, y: 0.0243), CGPoint(x: 0.5658, y: 0.0021),
         CGPoint(x: 0.5325, y: -0.0075), CGPoint(x: 0.5138, y: -0.0192), CGPoint(x: 0.4237, y: -0.0273)],
        [CGPoint(x: 0.5915, y: 0.6193), CGPoint(x: 0.6003, y: 0.6198), CGPoint(x: 0.6051, y: 0.6294),
         CGPoint(x: 0.6065, y: 0.6987), CGPoint(x: 0.6030, y: 0.7094), CGPoint(x: 0.5791, y: 0.7311),
         CGPoint(x: 0.5493, y: 0.7434), CGPoint(x: 0.4991, y: 0.7768), CGPoint(x: 0.4755, y: 0.7856),
         CGPoint(x: 0.3803, y: 0.8423), CGPoint(x: 0.3101, y: 0.8617), CGPoint(x: 0.2639, y: 0.8607),
         CGPoint(x: 0.2101, y: 0.8447), CGPoint(x: 0.1602, y: 0.8126), CGPoint(x: 0.1332, y: 0.7824),
         CGPoint(x: 0.1099, y: 0.7456), CGPoint(x: 0.0966, y: 0.6858), CGPoint(x: 0.0971, y: 0.6532),
         CGPoint(x: 0.1028, y: 0.6439), CGPoint(x: 0.1253, y: 0.6483), CGPoint(x: 0.1529, y: 0.6679),
         CGPoint(x: 0.1798, y: 0.6772), CGPoint(x: 0.2300, y: 0.7111), CGPoint(x: 0.2579, y: 0.7211),
         CGPoint(x: 0.3071, y: 0.7554), CGPoint(x: 0.3359, y: 0.7601), CGPoint(x: 0.3530, y: 0.7554),
         CGPoint(x: 0.5913, y: 0.6194)],
        [CGPoint(x: 0.1549, y: 0.2337), CGPoint(x: 0.1661, y: 0.2362), CGPoint(x: 0.1713, y: 0.2520),
         CGPoint(x: 0.1740, y: 0.4890), CGPoint(x: 0.2443, y: 0.5383), CGPoint(x: 0.3815, y: 0.6098),
         CGPoint(x: 0.3978, y: 0.6261), CGPoint(x: 0.4244, y: 0.6356), CGPoint(x: 0.4284, y: 0.6478),
         CGPoint(x: 0.4203, y: 0.6616), CGPoint(x: 0.3691, y: 0.6910), CGPoint(x: 0.3509, y: 0.6950),
         CGPoint(x: 0.3314, y: 0.6910), CGPoint(x: 0.3149, y: 0.6770), CGPoint(x: 0.2011, y: 0.6118),
         CGPoint(x: 0.1787, y: 0.6039), CGPoint(x: 0.1148, y: 0.5618), CGPoint(x: 0.0696, y: 0.5126),
         CGPoint(x: 0.0463, y: 0.4673), CGPoint(x: 0.0413, y: 0.4222), CGPoint(x: 0.0428, y: 0.3713),
         CGPoint(x: 0.0661, y: 0.3121), CGPoint(x: 0.1072, y: 0.2634), CGPoint(x: 0.1340, y: 0.2422),
         CGPoint(x: 0.1549, y: 0.2337)],
        [CGPoint(x: 0.6595, y: 0.4590), CGPoint(x: 0.6735, y: 0.4607), CGPoint(x: 0.7335, y: 0.5002),
         CGPoint(x: 0.7409, y: 0.5112), CGPoint(x: 0.7407, y: 0.7673), CGPoint(x: 0.7335, y: 0.8119),
         CGPoint(x: 0.6907, y: 0.8831), CGPoint(x: 0.6628, y: 0.9073), CGPoint(x: 0.6193, y: 0.9293),
         CGPoint(x: 0.5683, y: 0.9410), CGPoint(x: 0.4861, y: 0.9339), CGPoint(x: 0.4346, y: 0.9106),
         CGPoint(x: 0.4283, y: 0.8998), CGPoint(x: 0.4330, y: 0.8914), CGPoint(x: 0.4606, y: 0.8724),
         CGPoint(x: 0.5577, y: 0.8212), CGPoint(x: 0.5741, y: 0.8071), CGPoint(x: 0.5975, y: 0.7986),
         CGPoint(x: 0.6123, y: 0.7854), CGPoint(x: 0.6347, y: 0.7751), CGPoint(x: 0.6475, y: 0.7604),
         CGPoint(x: 0.6525, y: 0.7361), CGPoint(x: 0.6513, y: 0.4738), CGPoint(x: 0.6592, y: 0.4591)],
        [CGPoint(x: 0.4201, y: 0.0407), CGPoint(x: 0.4901, y: 0.0454), CGPoint(x: 0.5415, y: 0.0677),
         CGPoint(x: 0.5485, y: 0.0825), CGPoint(x: 0.5360, y: 0.1008), CGPoint(x: 0.5091, y: 0.1112),
         CGPoint(x: 0.4589, y: 0.1456), CGPoint(x: 0.3563, y: 0.1987), CGPoint(x: 0.3290, y: 0.2258),
         CGPoint(x: 0.3275, y: 0.5024), CGPoint(x: 0.3233, y: 0.5161), CGPoint(x: 0.3135, y: 0.5208),
         CGPoint(x: 0.3039, y: 0.5183), CGPoint(x: 0.2881, y: 0.5027), CGPoint(x: 0.2618, y: 0.4935),
         CGPoint(x: 0.2379, y: 0.4671), CGPoint(x: 0.2377, y: 0.2259), CGPoint(x: 0.2419, y: 0.1878),
         CGPoint(x: 0.2623, y: 0.1376), CGPoint(x: 0.3041, y: 0.0883), CGPoint(x: 0.3313, y: 0.0668),
         CGPoint(x: 0.3713, y: 0.0482), CGPoint(x: 0.4197, y: 0.0407)],
        [CGPoint(x: 0.6793, y: 0.1223), CGPoint(x: 0.7157, y: 0.1231), CGPoint(x: 0.7641, y: 0.1328),
         CGPoint(x: 0.8047, y: 0.1561), CGPoint(x: 0.8276, y: 0.1768), CGPoint(x: 0.8625, y: 0.2233),
         CGPoint(x: 0.8807, y: 0.2686), CGPoint(x: 0.8876, y: 0.3190), CGPoint(x: 0.8831, y: 0.3376),
         CGPoint(x: 0.8696, y: 0.3399), CGPoint(x: 0.8290, y: 0.3206), CGPoint(x: 0.7808, y: 0.2871),
         CGPoint(x: 0.7555, y: 0.2771), CGPoint(x: 0.7028, y: 0.2432), CGPoint(x: 0.6491, y: 0.2198),
         CGPoint(x: 0.6010, y: 0.2420), CGPoint(x: 0.3950, y: 0.3609), CGPoint(x: 0.3770, y: 0.3587),
         CGPoint(x: 0.3753, y: 0.2836), CGPoint(x: 0.3855, y: 0.2637), CGPoint(x: 0.6109, y: 0.1354),
         CGPoint(x: 0.6793, y: 0.1223)],
        [CGPoint(x: 0.6168, y: 0.2853), CGPoint(x: 0.6369, y: 0.2862), CGPoint(x: 0.8593, y: 0.4128),
         CGPoint(x: 0.9080, y: 0.4616), CGPoint(x: 0.9290, y: 0.4972), CGPoint(x: 0.9405, y: 0.5690),
         CGPoint(x: 0.9306, y: 0.6410), CGPoint(x: 0.9050, y: 0.6876), CGPoint(x: 0.8550, y: 0.7354),
         CGPoint(x: 0.8203, y: 0.7467), CGPoint(x: 0.8106, y: 0.7381), CGPoint(x: 0.8105, y: 0.5166),
         CGPoint(x: 0.8003, y: 0.4834), CGPoint(x: 0.7040, y: 0.4293), CGPoint(x: 0.6883, y: 0.4155),
         CGPoint(x: 0.6661, y: 0.4077), CGPoint(x: 0.5469, y: 0.3401), CGPoint(x: 0.5506, y: 0.3260),
         CGPoint(x: 0.6001, y: 0.2999), CGPoint(x: 0.6168, y: 0.2853)],
        [CGPoint(x: 0.4779, y: 0.3668), CGPoint(x: 0.5139, y: 0.3713), CGPoint(x: 0.5650, y: 0.4061),
         CGPoint(x: 0.5917, y: 0.4164), CGPoint(x: 0.6023, y: 0.4290), CGPoint(x: 0.6061, y: 0.4482),
         CGPoint(x: 0.6032, y: 0.5543), CGPoint(x: 0.5631, y: 0.5821), CGPoint(x: 0.4922, y: 0.6155),
         CGPoint(x: 0.4806, y: 0.6145), CGPoint(x: 0.4134, y: 0.5801), CGPoint(x: 0.3827, y: 0.5553),
         CGPoint(x: 0.3749, y: 0.5304), CGPoint(x: 0.3747, y: 0.4480), CGPoint(x: 0.3821, y: 0.4243),
         CGPoint(x: 0.4778, y: 0.3668)],
    ]

    static let antigravity: [[CGPoint]] = [
        [
         CGPoint(x: 0.9063, y: 0.9397), CGPoint(x: 0.9134, y: 0.9446), CGPoint(x: 0.9207, y: 0.9487),
         CGPoint(x: 0.9282, y: 0.9522), CGPoint(x: 0.9357, y: 0.9549), CGPoint(x: 0.9431, y: 0.9570),
         CGPoint(x: 0.9505, y: 0.9583), CGPoint(x: 0.9576, y: 0.9590), CGPoint(x: 0.9645, y: 0.9591),
         CGPoint(x: 0.9709, y: 0.9585), CGPoint(x: 0.9770, y: 0.9572), CGPoint(x: 0.9825, y: 0.9553),
         CGPoint(x: 0.9874, y: 0.9528), CGPoint(x: 0.9917, y: 0.9496), CGPoint(x: 0.9951, y: 0.9459),
         CGPoint(x: 0.9977, y: 0.9415), CGPoint(x: 0.9994, y: 0.9366), CGPoint(x: 1.0000, y: 0.9311),
         CGPoint(x: 0.9995, y: 0.9250), CGPoint(x: 0.9979, y: 0.9183), CGPoint(x: 0.9950, y: 0.9111),
         CGPoint(x: 0.9908, y: 0.9033), CGPoint(x: 0.9851, y: 0.8950), CGPoint(x: 0.9779, y: 0.8862),
         CGPoint(x: 0.9691, y: 0.8769), CGPoint(x: 0.9417, y: 0.8470), CGPoint(x: 0.9170, y: 0.8135),
         CGPoint(x: 0.8946, y: 0.7768), CGPoint(x: 0.8744, y: 0.7373), CGPoint(x: 0.8560, y: 0.6955),
         CGPoint(x: 0.8391, y: 0.6518), CGPoint(x: 0.8236, y: 0.6067), CGPoint(x: 0.8091, y: 0.5605),
         CGPoint(x: 0.7954, y: 0.5138), CGPoint(x: 0.7822, y: 0.4669), CGPoint(x: 0.7692, y: 0.4203),
         CGPoint(x: 0.7562, y: 0.3744), CGPoint(x: 0.7430, y: 0.3297), CGPoint(x: 0.7291, y: 0.2866),
         CGPoint(x: 0.7145, y: 0.2455), CGPoint(x: 0.6987, y: 0.2069), CGPoint(x: 0.6816, y: 0.1712),
         CGPoint(x: 0.6629, y: 0.1389), CGPoint(x: 0.6423, y: 0.1103), CGPoint(x: 0.6195, y: 0.0859),
         CGPoint(x: 0.5943, y: 0.0662), CGPoint(x: 0.5664, y: 0.0516), CGPoint(x: 0.5356, y: 0.0425),
         CGPoint(x: 0.5015, y: 0.0394), CGPoint(x: 0.4675, y: 0.0425), CGPoint(x: 0.4366, y: 0.0516),
         CGPoint(x: 0.4087, y: 0.0662), CGPoint(x: 0.3835, y: 0.0859), CGPoint(x: 0.3608, y: 0.1103),
         CGPoint(x: 0.3402, y: 0.1389), CGPoint(x: 0.3214, y: 0.1712), CGPoint(x: 0.3043, y: 0.2069),
         CGPoint(x: 0.2886, y: 0.2455), CGPoint(x: 0.2739, y: 0.2866), CGPoint(x: 0.2601, y: 0.3297),
         CGPoint(x: 0.2468, y: 0.3744), CGPoint(x: 0.2338, y: 0.4203), CGPoint(x: 0.2209, y: 0.4669),
         CGPoint(x: 0.2077, y: 0.5138), CGPoint(x: 0.1939, y: 0.5605), CGPoint(x: 0.1795, y: 0.6067),
         CGPoint(x: 0.1639, y: 0.6518), CGPoint(x: 0.1471, y: 0.6955), CGPoint(x: 0.1287, y: 0.7373),
         CGPoint(x: 0.1084, y: 0.7768), CGPoint(x: 0.0861, y: 0.8135), CGPoint(x: 0.0613, y: 0.8470),
         CGPoint(x: 0.0340, y: 0.8769), CGPoint(x: 0.0244, y: 0.8870), CGPoint(x: 0.0165, y: 0.8965),
         CGPoint(x: 0.0103, y: 0.9054), CGPoint(x: 0.0056, y: 0.9135), CGPoint(x: 0.0024, y: 0.9210),
         CGPoint(x: 0.0006, y: 0.9279), CGPoint(x: 0.0000, y: 0.9341), CGPoint(x: 0.0006, y: 0.9397),
         CGPoint(x: 0.0023, y: 0.9446), CGPoint(x: 0.0050, y: 0.9488), CGPoint(x: 0.0086, y: 0.9524),
         CGPoint(x: 0.0130, y: 0.9554), CGPoint(x: 0.0181, y: 0.9577), CGPoint(x: 0.0239, y: 0.9593),
         CGPoint(x: 0.0303, y: 0.9603), CGPoint(x: 0.0370, y: 0.9606), CGPoint(x: 0.0442, y: 0.9603),
         CGPoint(x: 0.0516, y: 0.9593), CGPoint(x: 0.0592, y: 0.9577), CGPoint(x: 0.0669, y: 0.9554),
         CGPoint(x: 0.0746, y: 0.9524), CGPoint(x: 0.0822, y: 0.9488), CGPoint(x: 0.0896, y: 0.9446),
         CGPoint(x: 0.0967, y: 0.9397), CGPoint(x: 0.1226, y: 0.9208), CGPoint(x: 0.1463, y: 0.9009),
         CGPoint(x: 0.1679, y: 0.8802), CGPoint(x: 0.1878, y: 0.8588), CGPoint(x: 0.2060, y: 0.8369),
         CGPoint(x: 0.2228, y: 0.8146), CGPoint(x: 0.2383, y: 0.7921), CGPoint(x: 0.2529, y: 0.7696),
         CGPoint(x: 0.2665, y: 0.7472), CGPoint(x: 0.2795, y: 0.7251), CGPoint(x: 0.2921, y: 0.7034),
         CGPoint(x: 0.3044, y: 0.6823), CGPoint(x: 0.3166, y: 0.6620), CGPoint(x: 0.3289, y: 0.6426),
         CGPoint(x: 0.3415, y: 0.6243), CGPoint(x: 0.3547, y: 0.6073), CGPoint(x: 0.3686, y: 0.5916),
         CGPoint(x: 0.3833, y: 0.5775), CGPoint(x: 0.3992, y: 0.5652), CGPoint(x: 0.4163, y: 0.5547),
         CGPoint(x: 0.4349, y: 0.5463), CGPoint(x: 0.4552, y: 0.5401), CGPoint(x: 0.4773, y: 0.5362),
         CGPoint(x: 0.5015, y: 0.5349), CGPoint(x: 0.5257, y: 0.5362), CGPoint(x: 0.5479, y: 0.5401),
         CGPoint(x: 0.5682, y: 0.5463), CGPoint(x: 0.5868, y: 0.5547), CGPoint(x: 0.6039, y: 0.5652),
         CGPoint(x: 0.6197, y: 0.5775), CGPoint(x: 0.6345, y: 0.5916), CGPoint(x: 0.6483, y: 0.6073),
         CGPoint(x: 0.6615, y: 0.6243), CGPoint(x: 0.6741, y: 0.6426), CGPoint(x: 0.6865, y: 0.6620),
         CGPoint(x: 0.6987, y: 0.6823), CGPoint(x: 0.7110, y: 0.7034), CGPoint(x: 0.7235, y: 0.7251),
         CGPoint(x: 0.7365, y: 0.7472), CGPoint(x: 0.7502, y: 0.7696), CGPoint(x: 0.7647, y: 0.7921),
         CGPoint(x: 0.7802, y: 0.8146), CGPoint(x: 0.7970, y: 0.8369), CGPoint(x: 0.8153, y: 0.8588),
         CGPoint(x: 0.8351, y: 0.8802), CGPoint(x: 0.8568, y: 0.9009), CGPoint(x: 0.8804, y: 0.9208),
         CGPoint(x: 0.9063, y: 0.9397), CGPoint(x: 0.9063, y: 0.9397)
        ]
    ]

    /// Grok's mark, flattened from grok.com's favicon SVG.
    ///
    /// Two filled loops — the interlocking swirls with the diagonal slash —
    /// not the rounded-square background. Flattened rather than traced, like
    /// `cursor` and `antigravity`.
    ///
    static let grok: [[CGPoint]] = [
        [
         CGPoint(x: 0.3862, y: 0.6419), CGPoint(x: 0.7187, y: 0.3860), CGPoint(x: 0.7212, y: 0.3842),
         CGPoint(x: 0.7237, y: 0.3827), CGPoint(x: 0.7264, y: 0.3815), CGPoint(x: 0.7291, y: 0.3805),
         CGPoint(x: 0.7318, y: 0.3798), CGPoint(x: 0.7346, y: 0.3793), CGPoint(x: 0.7374, y: 0.3791),
         CGPoint(x: 0.7401, y: 0.3791), CGPoint(x: 0.7429, y: 0.3794), CGPoint(x: 0.7455, y: 0.3799),
         CGPoint(x: 0.7482, y: 0.3806), CGPoint(x: 0.7507, y: 0.3816), CGPoint(x: 0.7531, y: 0.3828),
         CGPoint(x: 0.7554, y: 0.3843), CGPoint(x: 0.7576, y: 0.3860), CGPoint(x: 0.7597, y: 0.3879),
         CGPoint(x: 0.7616, y: 0.3900), CGPoint(x: 0.7632, y: 0.3924), CGPoint(x: 0.7647, y: 0.3950),
         CGPoint(x: 0.7660, y: 0.3978), CGPoint(x: 0.7717, y: 0.4134), CGPoint(x: 0.7765, y: 0.4292),
         CGPoint(x: 0.7804, y: 0.4452), CGPoint(x: 0.7834, y: 0.4615), CGPoint(x: 0.7855, y: 0.4778),
         CGPoint(x: 0.7867, y: 0.4943), CGPoint(x: 0.7870, y: 0.5108), CGPoint(x: 0.7864, y: 0.5273),
         CGPoint(x: 0.7849, y: 0.5437), CGPoint(x: 0.7825, y: 0.5601), CGPoint(x: 0.7791, y: 0.5763),
         CGPoint(x: 0.7749, y: 0.5924), CGPoint(x: 0.7697, y: 0.6082), CGPoint(x: 0.7636, y: 0.6237),
         CGPoint(x: 0.7565, y: 0.6390), CGPoint(x: 0.7486, y: 0.6539), CGPoint(x: 0.7397, y: 0.6683),
         CGPoint(x: 0.7298, y: 0.6824), CGPoint(x: 0.7190, y: 0.6959), CGPoint(x: 0.7073, y: 0.7089),
         CGPoint(x: 0.6949, y: 0.7211), CGPoint(x: 0.6820, y: 0.7324), CGPoint(x: 0.6687, y: 0.7426),
         CGPoint(x: 0.6550, y: 0.7519), CGPoint(x: 0.6410, y: 0.7602), CGPoint(x: 0.6267, y: 0.7675),
         CGPoint(x: 0.6120, y: 0.7739), CGPoint(x: 0.5971, y: 0.7792), CGPoint(x: 0.5820, y: 0.7837),
         CGPoint(x: 0.5667, y: 0.7871), CGPoint(x: 0.5512, y: 0.7896), CGPoint(x: 0.5355, y: 0.7912),
         CGPoint(x: 0.5198, y: 0.7918), CGPoint(x: 0.5040, y: 0.7915), CGPoint(x: 0.4882, y: 0.7902),
         CGPoint(x: 0.4723, y: 0.7880), CGPoint(x: 0.4565, y: 0.7849), CGPoint(x: 0.4407, y: 0.7808),
         CGPoint(x: 0.4250, y: 0.7759), CGPoint(x: 0.4094, y: 0.7700), CGPoint(x: 0.2964, y: 0.8245),
         CGPoint(x: 0.3210, y: 0.8408), CGPoint(x: 0.3460, y: 0.8549), CGPoint(x: 0.3713, y: 0.8669),
         CGPoint(x: 0.3970, y: 0.8769), CGPoint(x: 0.4228, y: 0.8848), CGPoint(x: 0.4487, y: 0.8908),
         CGPoint(x: 0.4747, y: 0.8947), CGPoint(x: 0.5006, y: 0.8968), CGPoint(x: 0.5264, y: 0.8970),
         CGPoint(x: 0.5520, y: 0.8953), CGPoint(x: 0.5773, y: 0.8917), CGPoint(x: 0.6022, y: 0.8864),
         CGPoint(x: 0.6266, y: 0.8793), CGPoint(x: 0.6506, y: 0.8705), CGPoint(x: 0.6739, y: 0.8600),
         CGPoint(x: 0.6965, y: 0.8478), CGPoint(x: 0.7183, y: 0.8340), CGPoint(x: 0.7392, y: 0.8186),
         CGPoint(x: 0.7592, y: 0.8016), CGPoint(x: 0.7782, y: 0.7831), CGPoint(x: 0.7923, y: 0.7676),
         CGPoint(x: 0.8055, y: 0.7516), CGPoint(x: 0.8176, y: 0.7350), CGPoint(x: 0.8287, y: 0.7181),
         CGPoint(x: 0.8389, y: 0.7007), CGPoint(x: 0.8481, y: 0.6830), CGPoint(x: 0.8563, y: 0.6649),
         CGPoint(x: 0.8635, y: 0.6466), CGPoint(x: 0.8698, y: 0.6280), CGPoint(x: 0.8751, y: 0.6092),
         CGPoint(x: 0.8795, y: 0.5902), CGPoint(x: 0.8830, y: 0.5711), CGPoint(x: 0.8855, y: 0.5518),
         CGPoint(x: 0.8871, y: 0.5326), CGPoint(x: 0.8878, y: 0.5133), CGPoint(x: 0.8876, y: 0.4940),
         CGPoint(x: 0.8865, y: 0.4747), CGPoint(x: 0.8844, y: 0.4556), CGPoint(x: 0.8815, y: 0.4366),
         CGPoint(x: 0.8777, y: 0.4177), CGPoint(x: 0.8780, y: 0.4180), CGPoint(x: 0.8725, y: 0.3912),
         CGPoint(x: 0.8684, y: 0.3660), CGPoint(x: 0.8656, y: 0.3422), CGPoint(x: 0.8641, y: 0.3195),
         CGPoint(x: 0.8639, y: 0.2980), CGPoint(x: 0.8649, y: 0.2774), CGPoint(x: 0.8671, y: 0.2576),
         CGPoint(x: 0.8705, y: 0.2385), CGPoint(x: 0.8751, y: 0.2200), CGPoint(x: 0.8807, y: 0.2018),
         CGPoint(x: 0.8875, y: 0.1839), CGPoint(x: 0.8953, y: 0.1661), CGPoint(x: 0.9041, y: 0.1482),
         CGPoint(x: 0.9140, y: 0.1302), CGPoint(x: 0.9248, y: 0.1119), CGPoint(x: 0.9366, y: 0.0931),
         CGPoint(x: 0.9493, y: 0.0738), CGPoint(x: 0.9629, y: 0.0537), CGPoint(x: 0.9773, y: 0.0327),
         CGPoint(x: 0.9926, y: 0.0108), CGPoint(x: 0.9929, y: 0.0102), CGPoint(x: 0.9933, y: 0.0097),
         CGPoint(x: 0.9937, y: 0.0092), CGPoint(x: 0.9941, y: 0.0086), CGPoint(x: 0.9944, y: 0.0081),
         CGPoint(x: 0.9948, y: 0.0076), CGPoint(x: 0.9952, y: 0.0070), CGPoint(x: 0.9955, y: 0.0065),
         CGPoint(x: 0.9959, y: 0.0060), CGPoint(x: 0.9963, y: 0.0054), CGPoint(x: 0.9967, y: 0.0049),
         CGPoint(x: 0.9970, y: 0.0043), CGPoint(x: 0.9974, y: 0.0038), CGPoint(x: 0.9978, y: 0.0033),
         CGPoint(x: 0.9981, y: 0.0027), CGPoint(x: 0.9985, y: 0.0022), CGPoint(x: 0.9989, y: 0.0016),
         CGPoint(x: 0.9993, y: 0.0011), CGPoint(x: 0.9996, y: 0.0005), CGPoint(x: 1.0000, y: 0.0000),
         CGPoint(x: 0.8624, y: 0.1435), CGPoint(x: 0.8624, y: 0.1430), CGPoint(x: 0.3861, y: 0.6420),
        ],
        [
         CGPoint(x: 0.3176, y: 0.7041), CGPoint(x: 0.3012, y: 0.6863), CGPoint(x: 0.2867, y: 0.6676),
         CGPoint(x: 0.2743, y: 0.6481), CGPoint(x: 0.2637, y: 0.6281), CGPoint(x: 0.2550, y: 0.6075),
         CGPoint(x: 0.2482, y: 0.5865), CGPoint(x: 0.2431, y: 0.5651), CGPoint(x: 0.2398, y: 0.5435),
         CGPoint(x: 0.2382, y: 0.5218), CGPoint(x: 0.2383, y: 0.5001), CGPoint(x: 0.2399, y: 0.4785),
         CGPoint(x: 0.2432, y: 0.4571), CGPoint(x: 0.2479, y: 0.4360), CGPoint(x: 0.2542, y: 0.4153),
         CGPoint(x: 0.2619, y: 0.3951), CGPoint(x: 0.2710, y: 0.3755), CGPoint(x: 0.2815, y: 0.3567),
         CGPoint(x: 0.2933, y: 0.3387), CGPoint(x: 0.3063, y: 0.3216), CGPoint(x: 0.3206, y: 0.3055),
         CGPoint(x: 0.3319, y: 0.2944), CGPoint(x: 0.3439, y: 0.2839), CGPoint(x: 0.3566, y: 0.2742),
         CGPoint(x: 0.3697, y: 0.2653), CGPoint(x: 0.3834, y: 0.2571), CGPoint(x: 0.3976, y: 0.2497),
         CGPoint(x: 0.4122, y: 0.2432), CGPoint(x: 0.4272, y: 0.2375), CGPoint(x: 0.4425, y: 0.2326),
         CGPoint(x: 0.4580, y: 0.2287), CGPoint(x: 0.4739, y: 0.2256), CGPoint(x: 0.4899, y: 0.2236),
         CGPoint(x: 0.5060, y: 0.2224), CGPoint(x: 0.5223, y: 0.2223), CGPoint(x: 0.5386, y: 0.2232),
         CGPoint(x: 0.5549, y: 0.2251), CGPoint(x: 0.5711, y: 0.2281), CGPoint(x: 0.5873, y: 0.2322),
         CGPoint(x: 0.6033, y: 0.2373), CGPoint(x: 0.6192, y: 0.2437), CGPoint(x: 0.7319, y: 0.1894),
         CGPoint(x: 0.7288, y: 0.1871), CGPoint(x: 0.7256, y: 0.1848), CGPoint(x: 0.7224, y: 0.1824),
         CGPoint(x: 0.7190, y: 0.1801), CGPoint(x: 0.7156, y: 0.1778), CGPoint(x: 0.7121, y: 0.1754),
         CGPoint(x: 0.7085, y: 0.1731), CGPoint(x: 0.7049, y: 0.1708), CGPoint(x: 0.7012, y: 0.1686),
         CGPoint(x: 0.6974, y: 0.1663), CGPoint(x: 0.6935, y: 0.1641), CGPoint(x: 0.6896, y: 0.1619),
         CGPoint(x: 0.6856, y: 0.1597), CGPoint(x: 0.6815, y: 0.1576), CGPoint(x: 0.6773, y: 0.1555),
         CGPoint(x: 0.6731, y: 0.1535), CGPoint(x: 0.6689, y: 0.1516), CGPoint(x: 0.6645, y: 0.1496),
         CGPoint(x: 0.6601, y: 0.1478), CGPoint(x: 0.6557, y: 0.1460), CGPoint(x: 0.6352, y: 0.1380),
         CGPoint(x: 0.6145, y: 0.1313), CGPoint(x: 0.5934, y: 0.1258), CGPoint(x: 0.5721, y: 0.1217),
         CGPoint(x: 0.5507, y: 0.1188), CGPoint(x: 0.5291, y: 0.1173), CGPoint(x: 0.5075, y: 0.1170),
         CGPoint(x: 0.4859, y: 0.1181), CGPoint(x: 0.4644, y: 0.1204), CGPoint(x: 0.4430, y: 0.1241),
         CGPoint(x: 0.4218, y: 0.1290), CGPoint(x: 0.4009, y: 0.1352), CGPoint(x: 0.3803, y: 0.1427),
         CGPoint(x: 0.3600, y: 0.1515), CGPoint(x: 0.3401, y: 0.1616), CGPoint(x: 0.3208, y: 0.1729),
         CGPoint(x: 0.3020, y: 0.1856), CGPoint(x: 0.2837, y: 0.1996), CGPoint(x: 0.2662, y: 0.2148),
         CGPoint(x: 0.2493, y: 0.2313), CGPoint(x: 0.2340, y: 0.2482), CGPoint(x: 0.2199, y: 0.2660),
         CGPoint(x: 0.2068, y: 0.2845), CGPoint(x: 0.1948, y: 0.3038), CGPoint(x: 0.1840, y: 0.3236),
         CGPoint(x: 0.1744, y: 0.3441), CGPoint(x: 0.1659, y: 0.3650), CGPoint(x: 0.1585, y: 0.3864),
         CGPoint(x: 0.1524, y: 0.4082), CGPoint(x: 0.1475, y: 0.4303), CGPoint(x: 0.1438, y: 0.4527),
         CGPoint(x: 0.1413, y: 0.4752), CGPoint(x: 0.1401, y: 0.4979), CGPoint(x: 0.1402, y: 0.5206),
         CGPoint(x: 0.1415, y: 0.5434), CGPoint(x: 0.1441, y: 0.5661), CGPoint(x: 0.1480, y: 0.5887),
         CGPoint(x: 0.1532, y: 0.6111), CGPoint(x: 0.1597, y: 0.6332), CGPoint(x: 0.1676, y: 0.6551),
         CGPoint(x: 0.1731, y: 0.6710), CGPoint(x: 0.1771, y: 0.6865), CGPoint(x: 0.1795, y: 0.7016),
         CGPoint(x: 0.1805, y: 0.7163), CGPoint(x: 0.1802, y: 0.7306), CGPoint(x: 0.1786, y: 0.7446),
         CGPoint(x: 0.1758, y: 0.7582), CGPoint(x: 0.1719, y: 0.7715), CGPoint(x: 0.1670, y: 0.7845),
         CGPoint(x: 0.1612, y: 0.7973), CGPoint(x: 0.1545, y: 0.8099), CGPoint(x: 0.1470, y: 0.8222),
         CGPoint(x: 0.1389, y: 0.8344), CGPoint(x: 0.1302, y: 0.8464), CGPoint(x: 0.1209, y: 0.8583),
         CGPoint(x: 0.1113, y: 0.8700), CGPoint(x: 0.1013, y: 0.8817), CGPoint(x: 0.0910, y: 0.8933),
         CGPoint(x: 0.0806, y: 0.9049), CGPoint(x: 0.0701, y: 0.9164), CGPoint(x: 0.0663, y: 0.9205),
         CGPoint(x: 0.0626, y: 0.9246), CGPoint(x: 0.0589, y: 0.9287), CGPoint(x: 0.0551, y: 0.9328),
         CGPoint(x: 0.0514, y: 0.9370), CGPoint(x: 0.0477, y: 0.9411), CGPoint(x: 0.0441, y: 0.9452),
         CGPoint(x: 0.0404, y: 0.9493), CGPoint(x: 0.0368, y: 0.9535), CGPoint(x: 0.0332, y: 0.9576),
         CGPoint(x: 0.0297, y: 0.9618), CGPoint(x: 0.0262, y: 0.9660), CGPoint(x: 0.0227, y: 0.9702),
         CGPoint(x: 0.0193, y: 0.9744), CGPoint(x: 0.0159, y: 0.9786), CGPoint(x: 0.0126, y: 0.9828),
         CGPoint(x: 0.0094, y: 0.9871), CGPoint(x: 0.0062, y: 0.9914), CGPoint(x: 0.0031, y: 0.9957),
         CGPoint(x: 0.0000, y: 1.0000), CGPoint(x: 0.3175, y: 0.7042),
        ]
    ]
}

// Same even-odd fill used by Codenotch to keep counters open in the Claude and
// OpenAI marks. The view has no provider-specific background or SF Symbol fallback.
struct GlyphShape: Shape {
  let outline: [[CGPoint]]

  func path(in rect: CGRect) -> Path {
    var path = Path()
    for loop in outline {
      guard let first = loop.first else { continue }
      path.move(to: point(first, in: rect))
      for p in loop.dropFirst() { path.addLine(to: point(p, in: rect)) }
      path.closeSubpath()
    }
    return path
  }

  private func point(_ p: CGPoint, in rect: CGRect) -> CGPoint {
    CGPoint(x: rect.minX + p.x * rect.width, y: rect.minY + p.y * rect.height)
  }
}

struct ProviderGlyphView: View {
  let glyph: ProviderGlyph
  var size: CGFloat = 28

  var body: some View {
    GlyphShape(outline: glyph.outline)
      .fill(style: FillStyle(eoFill: true))
      .scaleEffect(glyph.opticalScale)
      .frame(width: size, height: size)
  }
}
