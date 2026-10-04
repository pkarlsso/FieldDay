import ExpoModulesCore
import MapKit

public class AppleSearchCompleterModule: Module {
  private let completer = MKLocalSearchCompleter()
  private let searchDelegate = SearchCompleterDelegate()

  public func definition() -> ModuleDefinition {
    Name("AppleSearchCompleter")
    Events("onSearchResults")

    OnCreate {
      self.completer.delegate = self.searchDelegate
      self.searchDelegate.onResults = { [weak self] results, error in
        self?.sendEvent("onSearchResults", ["results": results, "error": error as Any])
      }
      self.completer.resultTypes = [.address, .pointOfInterest]
      self.completer.region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 40.4259, longitude: -86.9147),
        span: MKCoordinateSpan(latitudeDelta: 0.35, longitudeDelta: 0.35)
      )
    }

    Function("search") { (query: String) in
      self.completer.queryFragment = query
    }

    AsyncFunction("resolve") { (title: String, subtitle: String) async throws -> [String: Double] in
      let completion = self.completer.results.first {
        $0.title == title && $0.subtitle == subtitle
      }
      guard let completion else { throw NSError(domain: "AppleSearchCompleter", code: 1, userInfo: [NSLocalizedDescriptionKey: "Address suggestion is no longer available"]) }

      let request = MKLocalSearch.Request(completion: completion)
      let response = try await MKLocalSearch(request: request).start()
      guard let coordinate = response.mapItems.first?.placemark.coordinate else {
        throw NSError(domain: "AppleSearchCompleter", code: 2, userInfo: [NSLocalizedDescriptionKey: "Address has no map coordinate"])
      }
      return ["latitude": coordinate.latitude, "longitude": coordinate.longitude]
    }
  }
}

private final class SearchCompleterDelegate: NSObject, MKLocalSearchCompleterDelegate {
  var onResults: (([[String: String]], String?) -> Void)?

  func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    onResults?(completer.results.map { ["title": $0.title, "subtitle": $0.subtitle] }, nil)
  }

  func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    onResults?([], error.localizedDescription)
  }
}
